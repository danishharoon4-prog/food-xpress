import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const EFFECTIVE_DATE = "July 10, 2026";
const APP_NAME = "Food Xpress";
const OWNER = "Food Xpress";
const LOCATION = "Mansehra City, Pakistan";
const CONTACT_EMAIL = "Support@foodexpress.lovable.app";

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <article className="prose prose-sm sm:prose max-w-none dark:prose-invert text-foreground">
          <p className="text-sm text-muted-foreground">
            Effective date: {EFFECTIVE_DATE}
          </p>
          {children}
          <hr className="my-8" />
          <p className="text-sm text-muted-foreground">
            Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> · {OWNER}, {LOCATION}
          </p>
          <p className="text-xs text-muted-foreground">
            This page is maintained by {OWNER} to answer common privacy and legal questions about {APP_NAME}.
          </p>
        </article>
      </main>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalShell title="Privacy Policy">
      <h2>1. Introduction</h2>
      <p>
        This Privacy Policy explains how {OWNER} ("we", "us", "our") collects, uses, shares
        and protects information when you use the {APP_NAME} mobile application and website
        (together, the "Service"). By using the Service you agree to this Policy.
      </p>

      <h2>2. Information We Collect</h2>
      <ul>
        <li>
          <strong>Account information</strong> — your name, email address, phone number and
          password when you register.
        </li>
        <li>
          <strong>Profile photo &amp; documents</strong> — an optional profile picture, and for
          riders, verification documents (e.g. ID, license) uploaded by you.
        </li>
        <li>
          <strong>Precise location (GPS)</strong> — collected on the mobile app to find nearby
          restaurants, calculate delivery distance/fee, deliver your order to the correct
          address, and enable live order tracking for customers, riders and restaurants.
        </li>
        <li>
          <strong>Order &amp; delivery data</strong> — items ordered, delivery address, order
          history, ratings and support messages.
        </li>
        <li>
          <strong>Payment information</strong> — payments are processed by our third-party
          payment provider (JazzCash). We do not store your full card number, CVV or wallet
          PIN on our servers; we only receive transaction status and a reference ID.
        </li>
        <li>
          <strong>Device &amp; notification data</strong> — device push token (FCM), app
          version, OS and basic diagnostic logs to deliver notifications and improve
          reliability.
        </li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <ul>
        <li>To create and manage your account.</li>
        <li>To process orders, payments and deliveries.</li>
        <li>To match customers with riders and restaurants and enable live tracking.</li>
        <li>To send order updates and important service notifications.</li>
        <li>To provide customer support and resolve disputes.</li>
        <li>To prevent fraud, abuse and to comply with applicable laws.</li>
      </ul>

      <h2>4. Location Data</h2>
      <p>
        The mobile app requires location access to function. Precise location is used only
        while you are using the Service (or, for riders on active deliveries, in the
        background) to enable order fulfillment and live tracking. You can revoke location
        permission at any time from your device settings; some features will stop working.
      </p>

      <h2>5. Sharing of Information</h2>
      <p>We share information only as needed to provide the Service:</p>
      <ul>
        <li>
          <strong>Restaurants</strong> — receive your name, order details and delivery
          address for orders you place with them.
        </li>
        <li>
          <strong>Riders</strong> — receive your name, phone, delivery address and
          real-time location for the order they are delivering.
        </li>
        <li>
          <strong>Payment provider (JazzCash)</strong> — receives the information needed
          to process your transaction.
        </li>
        <li>
          <strong>Service providers</strong> — hosting, database, push notifications
          (Firebase Cloud Messaging) and maps (Google Maps).
        </li>
        <li>
          <strong>Legal</strong> — where required by law, court order or to protect
          rights, safety and property.
        </li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>6. Data Retention</h2>
      <p>
        We retain account and order data for as long as your account is active and for a
        reasonable period afterwards to comply with legal, tax and dispute-resolution
        obligations. You may request deletion of your account at any time (see Section 9).
      </p>

      <h2>7. Security</h2>
      <p>
        We use industry-standard measures including encrypted transport (HTTPS),
        role-based access controls and database row-level security to protect your data.
        No system is 100% secure; you use the Service at your own risk.
      </p>

      <h2>8. Children's Privacy</h2>
      <p>
        The Service is not intended for children under 13. We do not knowingly collect
        personal information from children under 13. If you believe a child has provided
        us information, please contact us and we will delete it.
      </p>

      <h2>9. Your Rights &amp; Choices</h2>
      <ul>
        <li>Access, update or correct your profile from the app.</li>
        <li>Revoke location, camera or notification permissions in device settings.</li>
        <li>
          Request account and data deletion by emailing{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will process your
          request within a reasonable time, subject to legal retention requirements.
        </li>
      </ul>

      <h2>10. Third-Party Services</h2>
      <p>
        The Service uses Google Maps, Firebase Cloud Messaging and JazzCash. Their use of
        your information is governed by their own privacy policies.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Policy from time to time. Material changes will be notified
        in-app or by email. Continued use of the Service after changes means you accept
        the updated Policy.
      </p>

      <h2>12. Contact Us</h2>
      <p>
        Questions or requests? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalShell>
  );
}

export function TermsAndConditions() {
  return (
    <LegalShell title="Terms & Conditions">
      <h2>1. Acceptance of Terms</h2>
      <p>
        By creating an account or using {APP_NAME} (the "Service"), you agree to these
        Terms &amp; Conditions and our Privacy Policy. If you do not agree, do not use
        the Service.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 13 years old to use the Service. By using it, you represent
        that you meet this requirement and that the information you provide is accurate.
      </p>

      <h2>3. The Service</h2>
      <p>
        {APP_NAME} is an online platform that connects customers with local restaurants
        and delivery riders in and around {LOCATION}. {OWNER} is not the manufacturer of
        the food and is not the employer of independent riders; we facilitate ordering,
        payment and delivery logistics.
      </p>

      <h2>4. Accounts</h2>
      <ul>
        <li>You are responsible for keeping your login credentials confidential.</li>
        <li>You are responsible for all activity under your account.</li>
        <li>
          We may suspend or terminate accounts for fraud, abuse, non-payment or breach
          of these Terms.
        </li>
      </ul>

      <h2>5. Orders, Pricing &amp; Payment</h2>
      <ul>
        <li>Menu items, prices and availability are set by restaurants and/or the admin.</li>
        <li>
          Delivery fees are calculated by distance (base fee + per-kilometre charge) and
          are shown before you confirm an order.
        </li>
        <li>
          You may pay by Cash on Delivery, JazzCash wallet or card via our payment
          provider. All prices are in Pakistani Rupees (PKR) unless stated otherwise.
        </li>
        <li>
          Once an order is accepted by a restaurant it generally cannot be cancelled by
          the customer; contact support in exceptional cases.
        </li>
      </ul>

      <h2>6. Delivery</h2>
      <p>
        Estimated delivery times are indicative only and depend on traffic, weather and
        restaurant preparation. You must provide accurate delivery details and be
        available to receive the order. If the rider cannot reach you or the address is
        wrong, the order may be cancelled and charges may still apply.
      </p>

      <h2>7. Refunds</h2>
      <p>
        Refund requests for missing, damaged or incorrect items must be submitted through
        in-app Support within 24 hours of delivery. Approved refunds are processed to the
        original payment method or your in-app wallet.
      </p>

      <h2>8. User Conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful, harmful or fraudulent purpose.</li>
        <li>Abuse, threaten or harass restaurants, riders, other users or staff.</li>
        <li>Attempt to interfere with, reverse-engineer or overload the Service.</li>
        <li>Upload false documents or impersonate another person.</li>
      </ul>
      <p>Violation may result in immediate suspension and legal action.</p>

      <h2>9. Rider Terms</h2>
      <p>
        Riders act as independent contractors, not employees. Riders must comply with
        traffic laws, carry valid documentation, keep uploaded documents up-to-date and
        deliver orders honestly and on time. Earnings are calculated per the tiered
        formula shown in the rider dashboard.
      </p>

      <h2>10. Restaurant Terms</h2>
      <p>
        Restaurant listings, menus, prices and images are managed by {OWNER}. Restaurants
        are responsible for the quality, safety, packaging and legal compliance of the
        food they prepare.
      </p>

      <h2>11. Intellectual Property</h2>
      <p>
        {APP_NAME}, its logo, design and software are the property of {OWNER} and
        protected by applicable laws. You may not copy, modify or distribute any part of
        the Service without written permission.
      </p>

      <h2>12. Disclaimers</h2>
      <p>
        The Service is provided "as is" and "as available" without warranties of any
        kind, express or implied. We do not guarantee uninterrupted, error-free or
        secure operation.
      </p>

      <h2>13. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, {OWNER} will not be liable for indirect,
        incidental, special or consequential damages, or for loss of profits, data or
        goodwill arising from your use of the Service. Our total liability for any claim
        shall not exceed the amount you paid for the order that gave rise to the claim.
      </p>

      <h2>14. Indemnity</h2>
      <p>
        You agree to indemnify and hold harmless {OWNER}, its employees and partners
        from any claims arising out of your breach of these Terms or your misuse of the
        Service.
      </p>

      <h2>15. Termination</h2>
      <p>
        We may suspend or terminate your access at any time for breach of these Terms or
        for reasons of security, fraud or non-payment. You may stop using the Service at
        any time by deleting your account.
      </p>

      <h2>16. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the Islamic Republic of Pakistan.
        Any dispute shall be subject to the exclusive jurisdiction of the courts of
        Mansehra, Pakistan.
      </p>

      <h2>17. Changes to Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be notified
        in-app. Continued use after changes means you accept the updated Terms.
      </p>

      <h2>18. Contact</h2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalShell>
  );
}

export default PrivacyPolicy;
