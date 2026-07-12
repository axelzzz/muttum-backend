import nodemailer, { type Transporter } from 'nodemailer';
import config from '../config';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
    });
  }
  return transporter;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await getTransporter().sendMail({
    from: config.smtp.from,
    to,
    subject: 'Réinitialisation de votre mot de passe Muttum',
    text: `Vous avez demandé la réinitialisation de votre mot de passe. Ouvrez ce lien pour en choisir un nouveau : ${resetUrl}\n\nCe lien expire dans ${config.passwordReset.tokenTtlMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
    html: `<p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
<p><a href="${resetUrl}">Cliquez ici pour choisir un nouveau mot de passe</a></p>
<p>Ce lien expire dans ${config.passwordReset.tokenTtlMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`,
  });
}
