import axios from 'axios';

const apiClient = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Response Error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

export { apiClient };