const {client, xml} = require('@xmpp/client');
const ipc = require('node-ipc');
require('dotenv').config();

const xmpp = client({
  service: process.env.XMPP_SERVER,
  domain: process.env.XMPP_DOMAIN,
  resource: process.env.XMPP_RESOURCE,
  username: process.env.XMPP_USERNAME,
  password: process.env.XMPP_PASSWORD,
});

xmpp.on('error', err => {
  console.error('❌', err.toString())
});
xmpp.on('status', status => {
  console.debug('🛈', 'status', status)
})
xmpp.on('input', input => {
  console.debug('⮈', input)
})
xmpp.on('output', output => {
  console.debug('⮊', output)
})

xmpp.start().catch(console.error);
ipc.config.id = 'xmpp';
ipc.config.retry = 1500;
ipc.serve(function () {
	ipc.server.on('message', function(data, socket){
		data.recipients.forEach( (recipient) => {
			var message = xml('message', {type: 'chat', to: recipient}, xml('body', {}, data.body));
			xmpp.send(message);
		});
    });
});
ipc.server.start();
