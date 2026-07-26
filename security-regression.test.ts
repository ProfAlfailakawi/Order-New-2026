import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicAppData,
  getCustomerOrderAccess,
  isAllowedPaymentLink,
  issueCustomerAccessToken,
  sanitizeSquadForCustomer,
  sanitizeTrackedOrder,
  tokenAuthorizesCustomerPhone,
} from "./security";
import {
  getCanonicalFinancialSummary,
  getCanonicalOrderReference,
} from "./src/lib/trackingPresentation";

const ownerPhone = "50000001";
const otherPhone = "50000002";
const participantPhone = "50000003";
const issued = issueCustomerAccessToken();
const trackingIssued = issueCustomerAccessToken();

const protectedOrder = {
  id: "ORD-EXACT-OWNER-1",
  customerName: "صاحب الطلب",
  customerPhone: ownerPhone,
  customerAccessTokenHash: issued.tokenHash,
  address: { region: "بيان", block: "1", street: "خاص" },
  generalNotes: "ملاحظة خاصة",
  total: 10,
  status: "جديد",
  splitType: "equal",
  splitPayments: [
    { name: "صاحب الطلب", phone: ownerPhone, amount: 5, status: "pending" },
    { name: "مشارك", phone: participantPhone, amount: 5, status: "pending" },
  ],
};

const protectedInvoice = {
  id: "INV-5085",
  customerName: "صاحب الفاتورة",
  customerPhone: ownerPhone,
  trackingAccessTokenHash: trackingIssued.tokenHash,
  totalAmount: 0.5,
  discount: 1,
  deliveryFee: 0,
  deliveryType: "free",
  items: [{ name: "جريش", quantity: 1, price: 1.5 }],
  deliveryInfo: {
    phone: otherPhone,
    contact: { mobile: otherPhone },
  },
};

test("public app data excludes operational and customer collections", () => {
  const result = buildPublicAppData({
    orders: [{ id: "secret" }],
    invoices: [{ id: "secret" }],
    customers: [{ phone: otherPhone }],
    diwaniyaPushTokens: [{ token: "secret" }],
    settings: {
      companyName: "التراث",
      storeStatus: { isOpen: true },
      privateApiKey: "must-not-leak",
    },
    zones: [{ id: "z1", name: "بيان" }],
  });

  assert.equal("orders" in result, false);
  assert.equal("invoices" in result, false);
  assert.equal("customers" in result, false);
  assert.equal("diwaniyaPushTokens" in result, false);
  assert.equal(result.settings.privateApiKey, undefined);
  assert.equal(result.settings.companyName, "التراث");
});

test("a phone number alone cannot read another customer's order", () => {
  assert.equal(
    getCustomerOrderAccess(protectedOrder, { phone: ownerPhone }),
    "none",
  );
  assert.equal(
    getCustomerOrderAccess(protectedOrder, {
      phone: otherPhone,
      orderId: protectedOrder.id,
      token: issued.token,
    }),
    "none",
  );
});

test("the valid customer token unlocks only its matching phone", () => {
  assert.equal(
    tokenAuthorizesCustomerPhone(
      [protectedOrder],
      ownerPhone,
      issued.token,
    ),
    true,
  );
  assert.equal(
    tokenAuthorizesCustomerPhone(
      [protectedOrder],
      otherPhone,
      issued.token,
    ),
    false,
  );
  assert.equal(
    getCustomerOrderAccess(protectedOrder, {
      phone: ownerPhone,
      token: issued.token,
      tokenAuthorizesPhone: true,
    }),
    "private",
  );
});

test("partial order IDs are rejected", () => {
  assert.equal(
    getCustomerOrderAccess(protectedOrder, {
      phone: ownerPhone,
      orderId: "NER-1",
      token: issued.token,
      tokenAuthorizesPhone: true,
    }),
    "none",
  );
});

test("a secure tracking token unlocks only its exact full reference", () => {
  assert.equal(
    getCustomerOrderAccess(protectedInvoice, {
      orderId: protectedInvoice.id,
      trackingToken: trackingIssued.token,
    }),
    "private",
  );
  assert.equal(
    getCustomerOrderAccess(protectedInvoice, {
      orderId: "5085",
      trackingToken: trackingIssued.token,
    }),
    "none",
  );
  assert.equal(
    getCustomerOrderAccess(
      { ...protectedInvoice, id: "INV-5086" },
      {
        orderId: protectedInvoice.id,
        trackingToken: trackingIssued.token,
      },
    ),
    "none",
  );
  assert.equal(
    getCustomerOrderAccess(protectedInvoice, {
      orderId: protectedInvoice.id,
      trackingToken: "wrong-token",
    }),
    "none",
  );
});

test("tracking responses preserve INV references and discounted totals", () => {
  assert.equal(
    getCanonicalOrderReference(protectedInvoice),
    "INV-5085",
  );
  assert.equal(
    getCanonicalOrderReference({ id: "ORD-20260727-6X1N" }),
    "ORD-20260727-6X1N",
  );

  const summary = getCanonicalFinancialSummary(
    protectedInvoice,
    1.5,
  );
  assert.equal(summary.subtotal, 1.5);
  assert.equal(summary.discountAmount, 1);
  assert.equal(summary.deliveryFee, 0);
  assert.equal(summary.grandTotal, 0.5);
});

test("split links work while hiding owner and other participant details", () => {
  const access = getCustomerOrderAccess(protectedOrder, {
    phone: participantPhone,
    orderId: protectedOrder.id,
  });
  assert.equal(access, "split");

  const result = sanitizeTrackedOrder(
    protectedOrder,
    access,
    participantPhone,
  );
  assert.equal(result.customerPhone, "");
  assert.equal(result.customerName, "");
  assert.equal(result.address, undefined);
  assert.equal(result.generalNotes, undefined);
  assert.equal(result.customerAccessTokenHash, undefined);
  assert.equal(result.splitPayments[0].phone, "");
  assert.equal(result.splitPayments[1].phone, participantPhone);
});

test("tracking token hashes never leave the tracking response", () => {
  const result = sanitizeTrackedOrder(
    protectedInvoice,
    "private",
  );
  assert.equal(result.trackingAccessTokenHash, undefined);
  assert.equal(result.customerPhone, "");
  assert.equal(result.deliveryInfo.phone, undefined);
  assert.equal(result.deliveryInfo.contact.mobile, "");
});

test("legacy orders require the full ID together with the matching phone", () => {
  const legacy = {
    id: "ORD-LEGACY-COMPLETE",
    customerPhone: ownerPhone,
    customerName: "عميل قديم",
  };
  assert.equal(
    getCustomerOrderAccess(legacy, {
      phone: ownerPhone,
      orderId: legacy.id,
    }),
    "private",
  );
  assert.equal(
    getCustomerOrderAccess(legacy, {
      phone: otherPhone,
      orderId: legacy.id,
    }),
    "none",
  );
});

test("stored payment links must be HTTPS UPayments links", () => {
  assert.equal(
    isAllowedPaymentLink("https://secure.upayments.com/pay/abc"),
    true,
  );
  assert.equal(isAllowedPaymentLink("https://example.com/pay/abc"), false);
  assert.equal(isAllowedPaymentLink("javascript:alert(1)"), false);
});

test("ten thousand wrong identities cannot cross the customer boundary", () => {
  for (let index = 0; index < 10_000; index += 1) {
    const wrongPhone = String(70_000_000 + (index % 9_999_999));
    const access = getCustomerOrderAccess(protectedOrder, {
      phone: wrongPhone,
      orderId:
        index % 2 === 0
          ? protectedOrder.id
          : `${protectedOrder.id}-${index}`,
      token: `wrong-token-${index}`,
      tokenAuthorizesPhone: false,
    });
    assert.equal(access, "none");
  }
});

test("squad responses never expose other members' phone numbers", () => {
  const squad = sanitizeSquadForCustomer(
    {
      id: "s1",
      phone: ownerPhone,
      ownerPhone,
      membersList: [
        { name: "أنا", phone: ownerPhone },
        {
          name: "عضو آخر",
          phone: otherPhone,
          contact: { mobile: otherPhone },
        },
      ],
    },
    ownerPhone,
  );

  assert.equal(squad.phone, ownerPhone);
  assert.equal(squad.ownerPhone, ownerPhone);
  assert.equal(squad.membersList[0].phone, ownerPhone);
  assert.equal(squad.membersList[1].phone, "");
  assert.equal(squad.membersList[1].contact.mobile, "");
});
