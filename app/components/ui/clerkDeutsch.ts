/* Deutsche Texte fuer die Clerk-Oberflaeche.

   Clerk liefert englisch aus. Das offizielle Paket @clerk/localizations
   waere die vollstaendige Loesung, ist hier aber nicht installiert — und eine
   neue Abhaengigkeit fuer ein paar Dutzend Zeichenketten ist es nicht wert.
   Hier stehen die Texte, die im Anmelde- und Registrierweg tatsaechlich
   auftauchen. Was fehlt, bleibt englisch; dann gehoert es hier ergaenzt. */
export const clerkDeutsch = {
  locale: "de-DE",
  dividerText: "oder",
  formButtonPrimary: "Weiter",
  socialButtonsBlockButton: "Weiter mit {{provider|titleize}}",
  formFieldLabel__emailAddress: "E-Mail",
  formFieldLabel__password: "Passwort",
  formFieldLabel__firstName: "Vorname",
  formFieldLabel__lastName: "Nachname",
  formFieldLabel__emailAddress_username: "E-Mail oder Benutzername",
  formFieldLabel__username: "Benutzername",
  formFieldInputPlaceholder__emailAddress: "name@firma.de",
  formFieldInputPlaceholder__emailAddress_username: "name@firma.de",
  formFieldInputPlaceholder__password: "mindestens 10 Zeichen",
  formFieldInputPlaceholder__firstName: "Vorname",
  formFieldInputPlaceholder__lastName: "Nachname",
  formFieldInputPlaceholder__username: "Benutzername",
  formFieldAction__forgotPassword: "Passwort vergessen?",
  formFieldError__notMatchingPasswords: "Die Passwörter stimmen nicht überein.",
  formFieldError__matchingPasswords: "Die Passwörter stimmen überein.",
  formFieldHintText__optional: "optional",
  backButton: "Zurück",
  footerActionLink__useAnotherMethod: "Anderen Weg nutzen",
  unstable__errors: {
    form_identifier_not_found: "Zu dieser E-Mail-Adresse gibt es keinen Zugang.",
    form_password_incorrect: "Das Passwort stimmt nicht.",
    form_password_pwned: "Dieses Passwort ist in einem Datenleck aufgetaucht. Bitte wähle ein anderes.",
    form_identifier_exists__email_address: "Zu dieser E-Mail-Adresse gibt es bereits einen Zugang.",
    form_param_format_invalid__email_address: "Bitte gib eine gültige E-Mail-Adresse ein.",
    form_password_length_too_short: "Das Passwort ist zu kurz.",
    form_param_nil: "Dieses Feld darf nicht leer sein.",
  },
  signIn: {
    start: {
      title: "Anmelden",
      subtitle: "Weiter zu deinem Arbeitsbereich",
      actionText: "Noch keinen Zugang?",
      actionLink: "Registrieren",
    },
    password: {
      title: "Passwort eingeben",
      subtitle: "Gib das Passwort zu deinem Zugang ein",
      actionLink: "Anderen Weg nutzen",
    },
    emailCode: {
      title: "Bestätigungscode",
      subtitle: "Wir haben dir einen Code geschickt",
      formTitle: "Bestätigungscode",
      formSubtitle: "Gib den Code aus der E-Mail ein",
      resendButton: "Code erneut senden",
    },
    emailLink: {
      title: "Magic-Link per E-Mail",
      subtitle: "Wir haben dir einen Anmeldelink geschickt",
      formTitle: "Anmeldelink",
      formSubtitle: "Öffne den Link in der E-Mail",
      resendButton: "Link erneut senden",
    },
    forgotPassword: {
      title: "Passwort zurücksetzen",
      subtitle: "Wir schicken dir einen Code per E-Mail",
      formTitle: "Code zum Zurücksetzen",
      resendButton: "Code erneut senden",
    },
    forgotPasswordAlternativeMethods: {
      title: "Passwort vergessen?",
      label__alternativeMethods: "Oder auf anderem Weg anmelden",
      blockButton__resetPassword: "Passwort zurücksetzen",
    },
    resetPassword: {
      title: "Neues Passwort setzen",
      formButtonPrimary: "Passwort speichern",
    },
    alternativeMethods: {
      title: "Anderer Weg",
      subtitle: "Wähl aus, wie du dich anmelden willst",
      actionLink: "Hilfe holen",
      blockButton__password: "Mit Passwort anmelden",
      blockButton__emailCode: "Code an {{identifier}} schicken",
      blockButton__emailLink: "Link an {{identifier}} schicken",
    },
    noAvailableMethods: {
      title: "Anmeldung nicht möglich",
      subtitle: "Es ist ein Fehler aufgetreten",
    },
  },
  signUp: {
    start: {
      title: "Arbeitsbereich anlegen",
      subtitle: "Leg deinen Zugang an",
      actionText: "Schon ein Zugang vorhanden?",
      actionLink: "Anmelden",
    },
    emailCode: {
      title: "E-Mail bestätigen",
      subtitle: "Wir haben dir einen Code geschickt",
      formTitle: "Bestätigungscode",
      formSubtitle: "Gib den Code aus der E-Mail ein",
      resendButton: "Code erneut senden",
    },
    emailLink: {
      title: "E-Mail bestätigen",
      subtitle: "Öffne den Link in der E-Mail",
      formTitle: "Bestätigungslink",
      formSubtitle: "Öffne den Link, den wir dir geschickt haben",
      resendButton: "Link erneut senden",
    },
    continue: {
      title: "Noch ein Schritt",
      subtitle: "Ergänze die fehlenden Angaben",
      actionText: "Schon ein Zugang vorhanden?",
      actionLink: "Anmelden",
    },
  },
};
