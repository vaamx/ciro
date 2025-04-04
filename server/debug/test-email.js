const https = require('https');

const options = {
  hostname: 'api.ciroai.us',
  port: 443,
  path: '/auth/reset-password?email=test%40example.com',
  method: 'GET'
};

console.log('Testing password reset URL generation...');
console.log('Request URL:', `https://${options.hostname}${options.path}`);

const req = https.request(options, res => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response data:', data);
    console.log('\nTest complete!');
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.end(); 