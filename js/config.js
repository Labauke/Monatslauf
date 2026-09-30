// Einstellungen für den Monatslauf.
// Die Supabase-Werte findest du im Supabase-Dashboard unter Project Settings → API (bzw. "API Keys").
// Bleiben sie leer, läuft die App im Demo-Modus und speichert nur auf dem jeweiligen Gerät.
window.MONATSLAUF_CONFIG = {
  supabaseUrl: 'https://mpmbzbbqrslniszxjrih.supabase.co',   // z. B. 'https://abcdefghijkl.supabase.co'
  supabaseKey: 'sb_publishable_16yrYWjLu-aXgBWdYpNBrw_WdKT--V5',   // der öffentliche "anon"- bzw. "publishable"-Key, niemals den "service_role"-Key

  // Öffentlicher Schlüssel für Push-Nachrichten (der geheime Teil gehört nur in die Supabase-Secrets, siehe README)
  vapidPublicKey: 'BJa1zy92QnugnlC848hvFVJJ_G2WyDw9Te31bF18NoQGHqRu_demOwlSmKstl9v6v0N4cqdmQoky59VA9i6bvOY',

  // Punkte pro Trainingsminute. Änderungen gelten sofort, auch rückwirkend für den laufenden Monat.
  factors: {
    laufen: 4,     // Joggen
    bouldern: 1,
    klettern: 1,
    home: 2,       // Home-Training
    fahrrad: 0.8,
    yoga: 1,
    anderes: 1,
  },
};
