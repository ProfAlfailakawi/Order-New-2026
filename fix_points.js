async function recalculatePoints() {
  try {
    const res = await fetch("http://127.0.0.1:3000/api/appdata");
    const appData = await res.json();
    
    const customers = appData.customers || [];
    const orders = appData.orders || [];
    const invoices = appData.invoices || [];

    const cleanPhone = (p) => {
        if (!p) return "";
        let cp = String(p).replace(/\D/g, "");
        if (cp.startsWith("965")) cp = cp.substring(3);
        if (cp.startsWith("00965")) cp = cp.substring(5);
        if (cp.startsWith("+965")) cp = cp.substring(4);
        return cp;
    };

    const customerPoints = {};
    const customerSpent = {};

    [...orders, ...invoices].forEach(o => {
        if (o.status && o.status.startsWith("تم الدفع")) {
            const phone = cleanPhone(o.customerPhone || o.phone || (o.address && o.address.phone));
            if (phone) {
                if (!customerPoints[phone]) {
                   customerPoints[phone] = 0;
                   customerSpent[phone] = 0;
                }
                const total = Number(o.total) || 0;
                customerPoints[phone] += total;
                customerSpent[phone] += total;
            }
        }
        
        // Split payments
        if (o.splitPayments && Array.isArray(o.splitPayments)) {
            o.splitPayments.forEach(sp => {
                if (sp.status === 'paid') {
                   const phone = cleanPhone(sp.phone);
                   if (phone) {
                       if (!customerPoints[phone]) {
                          customerPoints[phone] = 0;
                          customerSpent[phone] = 0;
                       }
                       const amount = Number(sp.amount) || 0;
                       customerPoints[phone] += amount;
                       customerSpent[phone] += amount;
                       
                       // Discount split order total from main customer to avoid double counting
                       const mainPhone = cleanPhone(o.customerPhone || o.phone || (o.address && o.address.phone));
                       if (mainPhone) {
                          customerPoints[mainPhone] -= amount;
                          customerSpent[mainPhone] -= amount;
                       }
                   }
                }
            });
        }
    });

    let updated = false;
    customers.forEach(c => {
        const phone = cleanPhone(c.phone);
        if (customerPoints[phone] !== undefined) {
            if (c.loyaltyPoints !== customerPoints[phone] || c.totalSpent !== customerSpent[phone]) {
                console.log(`Fixing customer ${c.name} (${c.phone}): Points ${c.loyaltyPoints} -> ${customerPoints[phone]}`);
                c.loyaltyPoints = customerPoints[phone];
                c.totalSpent = customerSpent[phone];
                updated = true;
            }
        }
    });

    if (updated) {
       await fetch("http://127.0.0.1:3000/api/appdata", {
           method: "PATCH",
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ customers: customers })
       });
       console.log("Points recalculated and saved!");
    } else {
       console.log("No points needed recalculation.");
    }
  } catch (e) {
    console.error(e);
  }
}

recalculatePoints();
