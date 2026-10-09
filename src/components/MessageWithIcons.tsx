import React from "react";
import {
  Anchor, Banknote, Clapperboard, CircleHelp, Compass, Diamond, Gift, KeyRound, Link, MessageCircle, Ticket, Trash2, Users, Wheat, Zap, Bell, Bird, Brain, Camera, Check, CircleCheck, CircleX, ClipboardList, Clover,
  Coffee, Coins, CookingPot, CreditCard, Crown, Dice5, Dices, Dna, DoorOpen, Droplet, Fish, Flame,
  FlaskConical, Footprints, Gem, Hand, Handshake, Heart, HeartCrack, Landmark, Leaf, Lock, Mail,
  MapPin, Medal, Megaphone, Moon, PartyPopper, Plane, Radar, RefreshCw, Rocket, Satellite, Save,
  Shield, Shirt, ShoppingCart, Smile, Soup, Sparkles, Star, Swords, Target, Tent, ThumbsUp,
  TriangleAlert, Trophy, User, Utensils, Wind, X,
} from "lucide-react";

type IconDef = { Icon: React.ComponentType<any>; cls: string; label?: string };

const GOLD = "text-accent";
const defs: Array<[string[], IconDef]> = [
  [["👑"], { Icon: Crown, cls: GOLD }],
  [["🤍", "❤️", "💛"], { Icon: Heart, cls: "text-[#ab2b2c]" }],
  [["💔"], { Icon: HeartCrack, cls: "text-red-500" }],
  [["🍲", "🍛"], { Icon: Soup, cls: GOLD }],
  [["🍽️", "🍽"], { Icon: Utensils, cls: GOLD }],
  [["🍳", "👨\u200D🍳"], { Icon: CookingPot, cls: GOLD }],
  [["✨", "🌟", "🌌"], { Icon: Sparkles, cls: GOLD }],
  [["⭐"], { Icon: Star, cls: GOLD }],
  [["🚀"], { Icon: Rocket, cls: GOLD }],
  [["🧬"], { Icon: Dna, cls: GOLD }],
  [["🔥"], { Icon: Flame, cls: "text-orange-500" }],
  [["🌙"], { Icon: Moon, cls: GOLD }],
  [["🛡️"], { Icon: Shield, cls: GOLD }],
  [["🏆"], { Icon: Trophy, cls: GOLD }],
  [["🥇", "🥈", "🥉", "🏅"], { Icon: Medal, cls: GOLD }],
  [["⚔️"], { Icon: Swords, cls: GOLD }],
  [["💎"], { Icon: Gem, cls: GOLD }],
  [["🎯"], { Icon: Target, cls: GOLD }],
  [["📡"], { Icon: Radar, cls: GOLD }],
  [["🛰️"], { Icon: Satellite, cls: GOLD }],
  [["📸"], { Icon: Camera, cls: GOLD }],
  [["⚠️"], { Icon: TriangleAlert, cls: "text-amber-600", label: "تنبيه" }],
  [["📍"], { Icon: MapPin, cls: GOLD }],
  [["✅"], { Icon: CircleCheck, cls: "text-emerald-600", label: "تم" }],
  [["❌"], { Icon: CircleX, cls: "text-red-500", label: "خطأ" }],
  [["✓"], { Icon: Check, cls: "text-emerald-600" }],
  [["✕"], { Icon: X, cls: "text-stone-500" }],
  [["🧠"], { Icon: Brain, cls: GOLD }],
  [["🎉"], { Icon: PartyPopper, cls: GOLD }],
  [["💾"], { Icon: Save, cls: GOLD }],
  [["🔐"], { Icon: Lock, cls: GOLD }],
  [["📋"], { Icon: ClipboardList, cls: GOLD }],
  [["☕", "🧉"], { Icon: Coffee, cls: GOLD }],
  [["🚪"], { Icon: DoorOpen, cls: GOLD }],
  [["🌿", "🍀"], { Icon: Leaf, cls: "text-emerald-700" }],
  [["🎰"], { Icon: Dices, cls: GOLD }],
  [["🎲"], { Icon: Dice5, cls: GOLD }],
  [["💸"], { Icon: Banknote, cls: GOLD }],
  [["🪙"], { Icon: Coins, cls: GOLD }],
  [["💳"], { Icon: CreditCard, cls: GOLD }],
  [["🏦"], { Icon: Landmark, cls: GOLD }],
  [["💧"], { Icon: Droplet, cls: "text-sky-600" }],
  [["🔄"], { Icon: RefreshCw, cls: GOLD }],
  [["🛒"], { Icon: ShoppingCart, cls: GOLD }],
  [["🔔"], { Icon: Bell, cls: GOLD }],
  [["🤝"], { Icon: Handshake, cls: GOLD }],
  [["📢"], { Icon: Megaphone, cls: GOLD }],
  [["💨"], { Icon: Wind, cls: "text-stone-500" }],
  [["🖐️"], { Icon: Hand, cls: GOLD }],
  [["👍", "👏"], { Icon: ThumbsUp, cls: GOLD }],
  [["⛺"], { Icon: Tent, cls: GOLD }],
  [["⚓"], { Icon: Anchor, cls: GOLD }],
  [["👨"], { Icon: User, cls: GOLD }],
  [["🧪"], { Icon: FlaskConical, cls: GOLD }],
  [["✈️"], { Icon: Plane, cls: GOLD }],
  [["💌"], { Icon: Mail, cls: GOLD }],
  [["😂", "😆", "😎", "😋", "😍", "😅", "😁", "😴"], { Icon: Smile, cls: GOLD }],
  [["🏃", "🏃\u200D♂️", "🏃\u200D♀️"], { Icon: Footprints, cls: GOLD }],
  [["🎣"], { Icon: Fish, cls: GOLD }],
  [["👕"], { Icon: Shirt, cls: GOLD }],
  [["🕊️"], { Icon: Bird, cls: GOLD }],
  [["⚡"], { Icon: Zap, cls: GOLD }],
  [["🗝️"], { Icon: KeyRound, cls: GOLD }],
  [["🎫"], { Icon: Ticket, cls: GOLD }],
  [["🛖"], { Icon: Tent, cls: GOLD }],
  [["👥"], { Icon: Users, cls: GOLD }],
  [["📷"], { Icon: Camera, cls: GOLD }],
  [["🌾"], { Icon: Wheat, cls: GOLD }],
  [["🗑️"], { Icon: Trash2, cls: "text-red-500" }],
  [["💬"], { Icon: MessageCircle, cls: GOLD }],
  [["🧭"], { Icon: Compass, cls: GOLD }],
  [["✖️"], { Icon: X, cls: "text-stone-500" }],
  [["🔗"], { Icon: Link, cls: GOLD }],
  [["🎁"], { Icon: Gift, cls: GOLD }],
  [["🤔"], { Icon: CircleHelp, cls: GOLD }],
  [["🎬"], { Icon: Clapperboard, cls: GOLD }],
  [["⚜️"], { Icon: Sparkles, cls: GOLD }],
  [["❖"], { Icon: Diamond, cls: GOLD }],
];

const strip = (s: string) => s.replace(/️/g, "");
const MAP: Record<string, IconDef> = {};
const keys: string[] = [];
for (const [list, def] of defs) for (const k of list) { MAP[strip(k)] = def; keys.push(strip(k)); }
keys.sort((a, b) => b.length - a.length);
// Display-only: decorative emoji inside message copy are drawn as thin lucide outline icons.
// The source strings are untouched (copy/share/aria keep the emoji).
const ICON_RE = new RegExp(`(${keys.map((k) => k + "\\uFE0F?").join("|")})`);

export const MessageWithIcons = ({ text }: { text: string }) => (
  <>
    {String(text).split(ICON_RE).map((part, i) => {
      const m = MAP[strip(part)];
      if (!m) return part;
      const { Icon, cls, label } = m;
      return (
        <Icon
          key={i}
          {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
          strokeWidth={1.6}
          className={`inline-block w-[1.1em] h-[1.1em] align-[-0.2em] mx-0.5 ${cls}`}
        />
      );
    })}
  </>
);

export default MessageWithIcons;
