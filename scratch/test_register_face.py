import requests, json
url = 'http://localhost:5000/api/v1/students/register-face'
payload = {"image_data": ["data:image/jpeg;base64,/9j/AAAA"]}
response = requests.post(url, json=payload)
print('Status:', response.status_code)
print('Response:', response.text)
