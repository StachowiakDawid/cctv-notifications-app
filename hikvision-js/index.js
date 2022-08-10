const hikvision = require('./hikvision.js').hikvision;
const fs = require('fs');
const axios = require('axios').default;
const format = require('date-fns').format;
const path = require('path');
require('dotenv').config();
axios.defaults.baseURL = process.env.APP_API_URL;

let recipients = [];
axios.get('/get-tokens').then((response) => {
	recipients = [...response.data];
}, err => console.log(err));

const onVMD = () => {
	const timestamp = Date.now();
	sendSnapshot(timestamp);
	axios({
		url: process.env.DOWNLOAD_SNAPSHOT_URL,
		method: 'GET',
		responseType: 'stream',
		auth: {
			username: process.env.HIKVISION_USER,
			password: process.env.HIKVISION_PASS,
		}
	}).then((response) => {
		response.data.pipe(fs.createWriteStream(path.join(process.env.IMAGES_DIRECTORY, `${timestamp}.jpg`)));
	}, err => console.log(err));
};

const sendSnapshot = async (timestamp) => {
	const url = `${process.env.SNAPHOST_URL}/${timestamp}.jpg`;
	const date = format(timestamp, 'dd-MM-yyyy HH:mm:ss');
	recipients.forEach(recipient => {
		sendFcmNotification(recipient, url, date);
	});
	axios.post('/new-message', {
		content: url,
	}).then((response) => {
		const newRecipients = response.data.filter((recipient) => !recipients.includes(recipient));
		newRecipients.forEach(recipient => {
			sendFcmNotification(recipient, url, date);
		});
		recipients = [...newRecipients, ...recipients];
	}, err => console.log(err));
};

const sendFcmNotification = async (to, url, body) => {
	axios.post('https://fcm.googleapis.com/fcm/send', {
		to,
		notification: {
			body,
			title: "Wykryto ruch",
			content_available: true,
		},
		data: {
			url
		},
		android: {
			priority: "high",
		},
	}, {
		headers: {
			Authorization: `key=${process.env.FIREBASE_AUTHORIZATION_KEY}`
		}
	});
};

new hikvision({
	host: process.env.HIKVISION_HOST,
	port: process.env.HIKVISION_PORT,
	user: process.env.HIKVISION_USER,
	pass: process.env.HIKVISION_PASS,
	log: true,
	onVMD,
});
