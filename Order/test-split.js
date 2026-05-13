import axios from 'axios';
axios.post('http://localhost:3000/api/create-split-payment', {
    orderId: "ORD-TEST-1778342752062",
    name: "test-user-from-ui-test",
    amount: 1,
    customerMobile: "99999999"
}).then(res => console.log("Success:", res.data)).catch(err => {
    console.log("Error Status:", err.response?.status, "Data:", err.response?.data);
});
