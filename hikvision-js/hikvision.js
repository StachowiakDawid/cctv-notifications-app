const net = require('net');
const parseString = require('xml2js').parseString;

class hikvision {
	constructor(options) {
		this.client = this.connect(options);
		this.TRACE = options.log ?? false;
		this.ended = false;
	}
	connect(options) {
		const credentials = Buffer.from(`${options.user}:${options.pass}`).toString('base64');
		const client = net.connect(options, () => {
			const header = 'GET /ISAPI/Event/notification/alertStream HTTP/1.1\r\n' +
				`Host: ${options.host}:${options.port}\r\n` +
				`Authorization: Basic ${credentials}\r\n` +
				'Accept: multipart/x-mixed-replace\r\n\r\n';
			client.write(header);
			client.setKeepAlive(true, 1000);
			if (this.TRACE) console.log(`Connected to ${options.host}:${options.port}`);
		});
		client.on('data', (data) => {
			parseString(data.toString().split("\n").slice(3).join("\n"), (err, result) => {
				if (result && result['EventNotificationAlert'] && parseInt(result['EventNotificationAlert']['activePostCount'][0]) > 0 && !this.ended) {
					options.onVMD(result['EventNotificationAlert']['dateTime'][0]);
					this.ended = true;
					setTimeout(() => this.ended = false, 10000);
				}
			});
		});
		client.on('close', () => {
			setTimeout(() => this.connect(options), 30000);
			if (this.TRACE) console.log("Connection closed!");
		});
		client.on('error', (err) => {
			if (this.TRACE) console.log("Connection error: " + err);
		});
	}
}
exports.hikvision = hikvision;
