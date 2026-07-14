const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'src', 'pages', 'CustomerSite.tsx');
let content = fs.readFileSync(target, 'utf8');

// 1. Move CheckoutOverlay outside of the motion.div
const checkoutOverlaySnippet = `        {/* Checkout Sidebar/Overlay */}
        <AnimatePresence>
          {isCheckout && !orderSuccess && (
            <CheckoutOverlay
              cart={cart}
              total={total}
              deliveryFee={deliveryFee}
              itemsTotal={itemsTotal}
              customerName={customerName}
              customerPhone={customerPhone}
              customerPoints={customerPoints}
              generalNotes={generalNotes}
              setGeneralNotes={setGeneralNotes}
              address={address}
              regions={regions}
              settings={settings}
              onRegionChange={handleRegionChange}
              setCustomerName={setCustomerName}
              setCustomerPhone={setCustomerPhone}
              setAddress={setAddress}
              isLocked={isLocked}
              setIsLocked={setIsLocked}
              setCustomerPoints={setCustomerPoints}
              onClose={() => setIsCheckout(false)}
              onRemove={removeFromCart}
              onSubmit={handleSubmitOrder}
              formError={formError}
              setFormError={setFormError}
              isSubmitting={isSubmitting}
              isDev={window.location.hostname.includes('ais-dev') || searchParams.get('dev') === 'true'}
              promoCodeInput={promoCodeInput}
              setPromoCodeInput={setPromoCodeInput}
              appliedPromo={appliedPromo}
              setAppliedPromo={setAppliedPromo}
              promoError={promoError}
              validatePromo={validatePromo}
              isValidatingPromo={isValidatingPromo}
              discountAmount={discountAmount}
            />
          )}
        </AnimatePresence>`;

// Remove the old checkout overlay block
content = content.replace(checkoutOverlaySnippet, '');

// Put it right before the closing </motion.div> and </>
const insertTarget = `        <div className="text-center py-4 opacity-20 pointer-events-none select-none text-[8px] font-light text-stone-400">
          Version 4.0.0.Release
        </div>
      </motion.div>`;

content = content.replace(insertTarget, insertTarget + `\n\n      ` + checkoutOverlaySnippet);

// 2. Add pt-[max(env(safe-area-inset-top),_1.5rem)] and h-[100dvh]
content = content.replace(
  /className="bg-background w-full sm:max-w-md h-full shadow-xl flex flex-col border-r border-stone-100"/g,
  'className="bg-background w-full sm:max-w-md h-[100dvh] overflow-hidden shadow-xl flex flex-col border-r border-stone-100"'
);

// We need to inject top padding to the header to prevent notch cutting, and ensure it isn't hidden under anything.
// We replace: className="p-6 border-b border-stone-100 flex items-center justify-between bg-white"
// With: className="p-6 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] border-b border-stone-100 flex items-center justify-between bg-white"
content = content.replace(
  /className="p-6 border-b border-stone-100 flex items-center justify-between bg-white"/g,
  'className="p-6 pt-[max(env(safe-area-inset-top,0px),1.5rem)] border-b border-stone-100 flex items-center justify-between bg-white shrink-0"'
);

fs.writeFileSync(target, content);
console.log('Fixed checkout clipping.');
