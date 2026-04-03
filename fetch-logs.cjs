const http = require('http');

http.get('http://localhost:3000/api/logs', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(json.logs.join('\n'));
    } catch (e) {
      console.error('Error parsing JSON:', e);
      console.log('Raw data:', data);
    }
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
