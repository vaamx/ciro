const https = require('https');

const options = {
  hostname: 'api.ciroai.us',
  port: 443,
  path: '/auth/request-password-reset',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const data = JSON.stringify({
  email: 'test@example.com'
});

console.log('Testing password reset URL generation...');
console.log('Request URL:', `https://${options.hostname}${options.path}`);
console.log('Request data:', data);

const req = https.request(options, res => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let responseData = '';
  res.on('data', chunk => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response data:', responseData);
    console.log('\nTest complete!');
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.write(data);
req.end(); 