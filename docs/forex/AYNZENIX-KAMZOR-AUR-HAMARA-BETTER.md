# Aynzenix mein kya kamzor hai, aur hamare Forex mein kya better hai

Yeh note 10 Oct 2026 ko `https://trade.aynzenix.com` ke demo login se bana hai. Koi order, deposit ya withdraw nahi bheja gaya. Balance, bank detail aur password is file mein nahi hain.

Isko seedha bolne ke liye use karo. Poora layout comparison alag file mein hai: `docs/forex/AYNZENIX-CLIENT-PORTAL-COMPARISON.md`.

## Unmein kya bekar hai

1. **Menu padha nahi ja sakta.** Desktop par left side sirf icons hain. Dashboard, Chart, Funds, Copy, IB — naam nahi likha. Naya user andaza lagata hai.

2. **Ghar trade ki jagah report hai.** Login ke baad KPI cards khulte hain. Chart alag icon ke peeche hai. Paise dekhne ke baad trade karne ke liye doosra page kholna padta hai.

3. **Margin ka line jhooth bolta hai.** Chart ke ticket par lal mein “Margin unavailable” likha tha. Neeche footer mein free margin balance ke barabar dikh raha tha. Ek hi screen par do jawab.

4. **Account card ka hisaab nahi milta.** Trading account ke hero par equity 0 dikhi, balance alag aur bada. User ko lagta hai system toot gaya hai.

5. **Buy aur Sell do jagah hain.** Chart ke header par Buy / lot / Sell hai, aur wahi symbol list ke andar dubara hai. Kaunsa button asal order hai, yeh clear nahi.

6. **Open Trades khali page hai.** “No open trades found” ke baad chart par le jane wala koi button nahi. Positions pehle se chart page par hain, yeh page wahi kaam dohra ke kharab karta hai.

7. **Wallets ek number teen baar dikhata hai.** Title, Main Wallet, aur active account — teeno par wahi total. Movement ya ledger nahi.

8. **Copy Trading blank khula.** Menu mein hai. Is session mein content area khaali tha, sirf icon rail dikhi.

9. **Mobile dashboard ke titles kat jaate hain.** Cards par `TOTAL TRAD...` aur `OPEN TRAD...` dikhta hai. Number dikhta hai, matlab nahi.

10. **Order sirf Market aur Limit hai.** Stop, Stop Limit, time-in-force, trailing, hedging, Close By, Reverse ticket par nahi dikhe.

11. **Login par wahi headline do baar hai.** Left image par “Welcome to Aynzenix”, form par phir wahi.

12. **Download App ka menu khali links par hai.** Item dikhta hai. Android aur iOS link client config mein khaali hain.

13. **Chart ke request 500 de rahe the.** Candles phir bhi ban gayi. Page complete dikhta hai aur toot kar bhi.

## Hamare mein kya better hai

1. **Trade ek screen par hai.** `/forex/trade` par Market Watch, chart, order ticket aur positions saath hain. Report page kholne ki zaroorat nahi.

2. **Menu mein naam likhe hain.** Trade, Markets, Portfolio, Orders, History. Icon yaad rakhne ki zaroorat nahi.

3. **Order types zyada hain.** Market, Limit, Stop, Stop Limit. Time-in-force: GTC, DAY, IOC, FOK, GTD, RETURN, BOC.

4. **Protection ticket par saaf hai.** Stop loss aur take profit price ya pips se. Trailing stop hai.

5. **Position ka control zyada hai.** Netting aur Hedging. Close, partial close, Close By, Reverse, aur SL/TP edit.

6. **Margin trade ke saath dikhta hai.** Equity, margin aur free margin usi workstation par rehte hain. Alag khali page nahi.

7. **Chart ka layout trader ke hisaab se badalta hai.** Candles, bars, line, area. Ek se lekar 3×3 tak layouts, fullscreen, drawings, RSI aur MACD.

8. **Positions wahi rehte hain jahan order lagta hai.** Alag “Open Trades” page khali chhodne ka scene nahi.

9. **Forex ka paisa crypto wallet se alag ledger hai.** Demo account, demo funding, aur apna double-entry hisaab. Exchange ke spot balance mein forex trade nahi ghusta.

## Bolte waqt yeh mat chhupana

Hamara forex execution abhi **simulated** hai. Unke paas bank, UPI aur crypto ka deposit form, account groups, aur copy / PAMM / MAM / IB ka menu hai. Woh cheezein is list mein “hamara better” nahi hain. Better woh hai jo upar trade screen par likha hai.
