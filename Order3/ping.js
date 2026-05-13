import axios from 'axios';
axios.post('http://localhost:3000/api/create-split-payment', {}).then(console.log).catch(err => {
    console.log(err.response?.status, err.response?.data);
});
