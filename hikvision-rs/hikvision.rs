use async_std::task;
use chrono::prelude::*;
use reqwest;
use serde_json;
use serde_json::Value;
use std::io::{self, BufReader, Read, Write};
use std::net::TcpStream;
use std::str;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use dotenvy;
use std::env;
use http_auth_basic::Credentials;

fn main() {
    let _ = dotenvy::dotenv();
    let http_auth_credentials: String = Credentials::new(env::var("HIKVISION_USER").unwrap().as_str(),env::var("HIKVISION_PASS").unwrap().as_str()).as_http_header();
    let (tx, rx) = mpsc::channel();
    let recipients_json: Value = serde_json::from_str(
        &reqwest::blocking::get(format!("{}/get-tokens", env::var("APP_API_URL").unwrap().as_str()))
            .unwrap()
            .text()
            .unwrap()
            .to_string(),
    )
    .unwrap();
    let recipients = recipients_json.as_array().unwrap();

    thread::spawn(move || loop {
        match TcpStream::connect(format!("{}:{}", env::var("HIKVISION_HOST").unwrap(), env::var("HIKVISION_PORT").unwrap())) {
            Err(_e) => {
                eprintln!("Could not connect to Server");
                thread::sleep(Duration::from_millis(5000));
                continue;
            }
            Ok(mut stream) => {
                let header: String = [
                    "GET /ISAPI/Event/notification/alertStream HTTP/1.1\r\n",
                    "Host: HIKVISION_HOST:HIKVISION_PORT\r\n",
                    format!("Authorization: {}\r\n", http_auth_credentials).as_str(),
                    "Accept: multipart/x-mixed-replace\r\n\r\n"
                ].concat();
                stream.write(header.as_bytes()).ok();
                match stream.set_read_timeout(Some(Duration::new(60, 0))) {
                    Ok(_) => {}
                    Err(..) => panic!("Setting Read Timeout Failed"),
                };
                match stream.set_write_timeout(Some(Duration::new(15, 0))) {
                    Ok(_) => {}
                    Err(..) => panic!("Setting Write Timeout Failed"),
                };
                loop {
                    let mut packet: BufReader<&TcpStream> = BufReader::new(&stream);
                    let mut xml: Vec<u8> = vec![0; 4096];
                    match packet.read(&mut xml) {
                        Ok(bytes) => {
                            if bytes != 0 {
                                let root: minidom::Element =
                                    match str::from_utf8(&xml).unwrap().parse() {
                                        Err(_) => continue,
                                        Ok(value) => value,
                                    };
                                let active_post_count: i32 = root
                                    .get_child(
                                        "activePostCount",
                                        "http://www.hikvision.com/ver20/XMLSchema",
                                    )
                                    .unwrap()
                                    .text()
                                    .parse()
                                    .unwrap();
                                if active_post_count > 0 {
                                    tx.send(
                                        SystemTime::now()
                                            .duration_since(UNIX_EPOCH)
                                            .unwrap()
                                            .as_millis(),
                                    )
                                    .unwrap();
                                    thread::sleep(Duration::new(10, 0));
                                }
                            }
                        }
                        Err(ref e) if e.kind() == io::ErrorKind::WouldBlock => {
                            continue;
                        }
                        Err(_e) => {
                            eprintln!("Encountered IO error: {}", _e.to_string());
                        }
                    };
                }
            }
        }
    });
    for received in rx {
        on_vmd(received, recipients);
        println!("{}", received);
    }
}

fn on_vmd(timestamp: u128, recipients: &Vec<Value>) {
    let date = chrono::offset::Local.timestamp_opt((timestamp/1000).try_into().unwrap(), 0).unwrap();
    let url = format!("{}/{}.jpg", env::var("SNAPHOST_URL").unwrap().as_str(), timestamp);
    let date = format!("{}", date.format("%Y-%m-%d %H:%M:%S").to_string());
    for recipient in recipients {
        send_fcm_notification(recipient.clone(), date.clone(), url.clone());
    }
    download_snapshot(timestamp);
    let new_recipients_json: Value = serde_json::from_str(
        &reqwest::blocking::Client::new()
            .post(format!("{}/new-message", env::var("APP_API_URL").unwrap().as_str()))
            .json(&serde_json::json!({
                "content": url
            }))
            .send()
            .unwrap()
            .text()
            .unwrap()
            .to_string(),
    )
    .unwrap();
    let new_recipients = new_recipients_json.as_array().unwrap();
    for new_recipient in new_recipients {
        if !recipients.contains(new_recipient) {
            send_fcm_notification(new_recipient.clone(), date.clone(), url.clone());
        }
    }
}

fn send_fcm_notification(recipient: Value, date: String, url: String) {
    task::spawn(async move {
        let fcm_notification_body = serde_json::json!({
            "to": recipient,
            "notification": {
                "body": date,
                "title": "Wykryto ruch",
                "content_available": true
            },
            "data": {
                "url": url
            },
            "android": {
                "priority": "high"
            }
        });
        reqwest::Client::new().post("https://fcm.googleapis.com/fcm/send").json(&fcm_notification_body)
    .header("Authorization", "key=FIREBASE_AUTHORIZATION_KEY")
    .send().await.unwrap();
    });
}

fn download_snapshot(timestamp: u128) {
    task::spawn(async move {
        let http_auth_credentials: String = Credentials::new(env::var("HIKVISION_USER").unwrap().as_str(),env::var("HIKVISION_PASS").unwrap().as_str()).as_http_header();
        let fname = std::path::Path::new(env::var("IMAGES_DIRECTORY").unwrap().as_str()).join(format!("{}.jpg", timestamp.to_string()));
        let mut dest = std::fs::File::create(fname).unwrap();
        reqwest::blocking::Client::new()
            .get(env::var("DOWNLOAD_SNAPSHOT_URL").unwrap())
            .header("Authorization", http_auth_credentials)
            .send()
            .unwrap()
            .copy_to(&mut dest).unwrap();
    });
}