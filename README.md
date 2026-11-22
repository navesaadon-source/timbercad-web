# TimberCad – אתר, אזור לקוחות וניהול הזמנות

אתר סטטי (React + Vite) שמתפרסם ב-GitHub Pages, עם מסד נתונים, כניסה וקבצים ב-Supabase.
בלי הגדרות Supabase האתר עולה ב**מצב הדגמה**: הנתונים נשמרים רק בדפדפן.

## מבנה
```
src/config.ts            פרטי העסק (טלפון, וואטסאפ, מייל) – עורכים כאן
src/pages/Home.tsx       דף הבית
src/pages/portal/*       אזור הלקוח: הזמנות, הזמנה חדשה, "הסטנדרט שלי"
src/pages/admin/*        ניהול: הזמנות, לקוחות, קטלוג, ייצוא לאקסל
src/pages/OrderPage.tsx  עמוד הזמנה (לקוח ומנהל)
supabase/schema.sql      טבלאות, הרשאות וכללי העבודה (הקפאה, נעילה בייצור)
supabase/seed.sql        קטלוג ברירת המחדל (חיבורים, צירים, מגירות, חומרים)
supabase/functions/notify  התראות למייל ולטלגרם
```

## הקמה (פעם אחת)

### 1. Supabase
1. פותחים פרויקט חדש ב-https://supabase.com (חינם).
2. SQL Editor → מדביקים ומריצים את `supabase/schema.sql`, ואחריו את `supabase/seed.sql`.
3. Project Settings → API: מעתיקים את `Project URL` ואת `anon public key`.

### 2. כניסה עם גוגל
1. ב-Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
2. Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`
3. ב-Supabase: Authentication → Providers → Google → מדביקים Client ID ו-Secret.
4. Authentication → URL Configuration → Site URL = כתובת האתר, ומוסיפים אותה גם ל-Redirect URLs.

המייל `timbercad.cnc@gmail.com` מקבל הרשאת מנהל אוטומטית בכניסה הראשונה (טבלה `admin_emails`).

### 3. התראות (הקפאת הזמנה, הזמנה חדשה)
1. טלגרם: פותחים בוט דרך @BotFather ומקבלים token. שולחים לבוט הודעה, ומוצאים את ה-chat id בכתובת
   `https://api.telegram.org/bot<token>/getUpdates`.
2. מייל: חשבון חינמי ב-https://resend.com ומפתח API.
3. מתקינים את Supabase CLI ומריצים:
   ```
   supabase functions deploy notify --no-verify-jwt --project-ref <project>
   supabase secrets set --project-ref <project> NOTIFY_SECRET=<סיסמה ארוכה> ADMIN_EMAIL=timbercad.cnc@gmail.com \
     RESEND_API_KEY=... TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... SITE_URL=https://<כתובת האתר>
   ```
4. ב-SQL Editor:
   ```sql
   insert into public.settings values
     ('notify_url', 'https://<project>.supabase.co/functions/v1/notify'),
     ('notify_secret', '<אותה סיסמה של NOTIFY_SECRET>')
   on conflict (key) do update set value = excluded.value;
   ```

### 4. GitHub Pages
1. מעלים את התיקייה הזו לריפו (במקום הקוד הישן).
2. Settings → Pages → Source: **GitHub Actions**.
3. Settings → Secrets and variables → Actions: מוסיפים `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY`.
4. כל push ל-main בונה ומפרסם את האתר אוטומטית (`.github/workflows/deploy.yml`).

## פיתוח מקומי
```
npm install
cp .env.example .env      # ממלאים את הפרטים של Supabase
npm run dev
npm run build:demo        # קובץ HTML יחיד במצב הדגמה (dist-demo/index.html)
```

## כללי העבודה (נאכפים במסד הנתונים, לא רק במסך)
| מצב | הלקוח יכול |
|---|---|
| התקבלה | לערוך הכל, לבטל |
| בייצור | רק להקפיא (נשלחת התראה) |
| מוקפאת | רק לבקש להמשיך (נשלחת התראה) |
| הושלמה / לחיוב / חויבה / בוטלה | לצפות בלבד |

המנהל יכול לשנות כל שדה ובכל מצב.
