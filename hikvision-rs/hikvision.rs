use async_std::task;
use chrono::prelude::*;
use chrono_tz::Europe::Warsaw;
use dotenvy;
use google_jwt_auth::usage::Usage;
use google_jwt_auth::AuthConfig;
use http_auth_basic::Credentials;
use reqwest;
use serde_json;
use serde_json::Value;
use std::env;
use std::io::{self, BufReader, Read, Write};
use std::net::TcpStream;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use std::{fs, str};

#[async_std::main]
async fn main() {
    let _ = dotenvy::dotenv();
    let (tx, rx) = mpsc::channel();
    let http_auth_credentials: String = Credentials::new(
        env::var("HIKVISION_USER").unwrap().as_str(),
        env::var("HIKVISION_PASS").unwrap().as_str(),
    )
    .as_http_header();
    let recipients_json: Value = serde_json::from_str(
        &reqwest::blocking::get(format!(
            "{}/get-tokens",
            env::var("APP_API_URL").unwrap().as_str()
        ))
        .unwrap()
        .text()
        .unwrap()
        .to_string(),
    )
    .unwrap();
    let recipients = recipients_json.as_array().unwrap();
    let google_auth_config = AuthConfig::build(
        fs::read_to_string(env::var("FIREBASE_SERVICE_ACCOUNT_KEY").unwrap())
            .unwrap()
            .as_str(),
        &Usage::FirebaseMessaging,
    )
    .unwrap();

    thread::spawn(move || loop {
        match TcpStream::connect(format!(
            "{}:{}",
            env::var("HIKVISION_HOST").unwrap(),
            env::var("HIKVISION_PORT").unwrap()
        )) {
            Err(_e) => {
                eprintln!("Could not connect to Server");
                thread::sleep(Duration::from_millis(5000));
                continue;
            }
            Ok(mut stream) => {
                let header: String = [
                    "GET /ISAPI/Event/notification/alertStream HTTP/1.1\r\n",
                    format!(
                        "Host: {}:{}\r\n",
                        env::var("HIKVISION_HOST").unwrap(),
                        env::var("HIKVISION_PORT").unwrap()
                    )
                    .as_str(),
                    format!("Authorization: {}\r\n", http_auth_credentials).as_str(),
                    "Accept: multipart/x-mixed-replace\r\n\r\n",
                ]
                .concat();
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
                                let xml_fixed =
                                    str::from_utf8(&xml).unwrap()
                                        .split_inclusive('\n')
                                        .skip_while(|line| !line.starts_with('<'))
                                        .collect::<String>();
                                let root: minidom::Element =
                                    match xml_fixed.parse() {
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
                                    let timestamp: String = root
                                        .get_child(
                                            "dateTime",
                                            "http://www.hikvision.com/ver20/XMLSchema",
                                        )
                                        .unwrap()
                                        .text()
                                        .parse()
                                        .unwrap();
                                    tx.send(timestamp).unwrap();
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
        on_vmd(
            received.clone(),
            recipients,
            google_auth_config.generate_auth_token(3600).await.unwrap(),
        );
    }
}

fn on_vmd(date: String, recipients: &Vec<Value>, auth_token: String) {
    let timestamp = NaiveDateTime::parse_from_str(&date[0..19], "%Y-%m-%dT%H:%M:%S").unwrap();
    let date = Warsaw.from_local_datetime(&timestamp).unwrap();
    println!("{}", date);
    let url = format!(
        "{}/{}.jpg",
        env::var("SNAPHOST_URL").unwrap().as_str(),
        timestamp.and_local_timezone(Warsaw).unwrap().timestamp_millis()
    );
    let date = format!("{}", date.format("%Y-%m-%d %H:%M:%S").to_string());
    for recipient in recipients {
        send_fcm_notification(
            recipient.clone(),
            date.clone(),
            url.clone(),
            auth_token.clone(),
        );
    }
    download_snapshot(timestamp.and_local_timezone(Warsaw).unwrap().timestamp_millis());
    let new_recipients_json: Value = serde_json::from_str(
        &reqwest::blocking::Client::new()
            .post(format!(
                "{}/new-message",
                env::var("APP_API_URL").unwrap().as_str()
            ))
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
            send_fcm_notification(
                new_recipient.clone(),
                date.clone(),
                url.clone(),
                auth_token.clone(),
            );
        }
    }
}

fn send_fcm_notification(recipient_token: Value, date: String, url: String, auth_token: String) {
    task::spawn(async move {
        let fcm_notification_body = serde_json::json!({
        "message": {
            "token": recipient_token,
            "notification": {
                "body": date,
                "title": "Wykryto ruch",
            },
            "data": {
                "url": url
            },
            "android": {
                "priority": "high",
            },
        }});
        reqwest::Client::new()
            .post(format!(
                "https://fcm.googleapis.com/v1/projects/{}/messages:send",
                env::var("FIREBASE_PROJECT_NAME").unwrap().as_str()
            ))
            .json(&fcm_notification_body)
            .header("Authorization", format!("Bearer {}", auth_token))
            .send()
            .await
            .unwrap();
    });
}

fn download_snapshot(timestamp: i64) {
    task::spawn(async move {
        let http_auth_credentials: String = Credentials::new(
            env::var("HIKVISION_USER").unwrap().as_str(),
            env::var("HIKVISION_PASS").unwrap().as_str(),
        )
        .as_http_header();
        let fname = std::path::Path::new(env::var("IMAGES_DIRECTORY").unwrap().as_str())
            .join(format!("{}.jpg", timestamp.to_string()));
        let mut dest = std::fs::File::create(fname).unwrap();
        reqwest::blocking::Client::new()
            .get(env::var("DOWNLOAD_SNAPSHOT_URL").unwrap())
            .header("Authorization", http_auth_credentials)
            .send()
            .unwrap()
            .copy_to(&mut dest)
            .unwrap();
    });
}
