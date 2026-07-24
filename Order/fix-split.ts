import fs from "fs";

function fixOrder() {
  const file = "output.json";
  if (!fs.existsSync(file)) return;
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  let orders = d.orders || [];
  
  const orderId = "ORD-1778952912568-8GM9";
  const order = orders.find((o: any) => o.id === orderId);
  
  if (order) {
    console.log("Found order:", order.id, "total:", order.total);
    console.log("Splits:", JSON.stringify(order.splitPayments, null, 2));
    
    // Convert 1KD pending from "ahmed" to paid
    if (order.splitPayments) {
      let changed = false;
      order.splitPayments.forEach((sp: any) => {
        if (sp.name === "ahmed" || Number(sp.amount) === 1) {
            console.log("Fixing split:", sp.id, "Amount:", sp.amount);
            if (sp.status !== "paid") {
              sp.status = "paid";
              changed = true;
            }
        }
      });
      if (changed) {
         fs.writeFileSync(file, JSON.stringify(d, null, 2));
         console.log("Saved fixed output.json");
      }
    }
  } else {
    console.log("Order not found");
  }
}

fixOrder();
