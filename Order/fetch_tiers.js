(async () => {
  const res = await fetch('http://localhost:3000/api/settings');
  const data = await res.json();
  console.log("Settings keys:", Object.keys(data));
  console.log("Loyalty Tiers:", JSON.stringify(data.loyaltyTiers, null, 2));
  console.log("Squad Tiers:", JSON.stringify(data.squadTiers, null, 2));
  console.log("Customer Tiers:", JSON.stringify(data.customerTiers, null, 2));
  console.log("Tiers:", JSON.stringify(data.tiers, null, 2));
})();
