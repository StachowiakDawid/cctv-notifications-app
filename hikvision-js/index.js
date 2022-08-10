const hikvision = require('./hikvision.js').hikvision;
const fs = require('fs');
const axios = require('axios').default;
const format = require('date-fns').format;
const parseISO = require('date-fns/parseISO')
const path = require('path');
const firebaseAdmin = require('firebase-admin');
const { JWT } = require('google-auth-library');

require('dotenv').config();
axios.defaults.baseURL = process.env.APP_API_URL;

firebaseAdmin.initializeApp({
	credential: firebaseAdmin.credential.cert(require(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
});

function getFirebaseAccessToken() {
	return new Promise(function (resolve, reject) {
		const key = require(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
		const jwtClient = new JWT(
			key.client_email,
			null,
			key.private_key,
			['https://www.googleapis.com/auth/firebase.messaging'],
			null
		);
		jwtClient.authorize(function (err, tokens) {
			if (err) {
				reject(err);
				return;
			}
			resolve(tokens.access_token);
		});
	});
}

let recipients = [];
axios.get('/get-tokens').then((response) => {
	recipients = [...response.data];
}, err => console.log(err));

const onVMD = (serverDatetime) => {
	const timestamp = parseISO(serverDatetime.slice(0, 19)).getTime();
	console.log(timestamp)
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
	const token = await getFirebaseAccessToken();
	recipients.forEach(recipient => {
		sendFcmNotification(recipient, url, date, token);
	});
	axios.post('/new-message', {
		content: url,
	}).then((response) => {
		const newRecipients = response.data.filter((recipient) => !recipients.includes(recipient));
		newRecipients.forEach(recipient => {
			sendFcmNotification(recipient, url, date, token);
		});
		recipients = [...newRecipients, ...recipients];
	}, err => console.log(err));
};

const sendFcmNotification = async (recipientToken, url, body, authToken) => {
	axios.post(`https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_NAME}/messages:send`, {
		message: {
			token: recipientToken,
			notification: {
				body,
				title: "Wykryto ruch",
			},
			data: {
				url
			},
			android: {
				priority: "high",
			},
		}
	}, {
		headers: {
			Authorization: `Bearer ${authToken}`
		}
	}).then(() => { }, (err) => {
		console.log(`err ${err}`);
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
