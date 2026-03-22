export type LegalDoc = {
  slug:
    | "terms-of-service"
    | "privacy-policy"
    | "cookie-policy"
    | "refund-cancellation-policy"
    | "host-terms"
    | "acceptable-use-policy"
    | "community-guidelines"
    | "parking-terms-liability"
    | "clamping-enforcement"
    | "data-processing-terms";
  title: string;
  summary: string;
  sections: Array<{
    heading: string;
    paragraphs?: string[];
    bullets?: string[];
  }>;
};

export const LEGAL_CONTACT = {
  brandName: "FreeSpace",
  supportEmail: "support@freespace.ie",
  registeredName: "FreeSpace",
  registeredAddress: "Dublin, Ireland",
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    summary: "The main marketplace terms for drivers, guests, and account holders using FreeSpace.",
    sections: [
      {
        heading: "Using the platform",
        paragraphs: [
          "FreeSpace lets drivers find, reserve, and pay for parking spaces offered by hosts and operators.",
          "By creating an account, browsing listings, or making a booking, you agree to these terms and any policies linked from them.",
          "FreeSpace operates as a marketplace technology platform. Unless explicitly stated otherwise for a specific site, FreeSpace is not the owner or physical operator of the parking location.",
        ],
      },
      {
        heading: "Accounts and eligibility",
        bullets: [
          "You must provide accurate account, vehicle, and payment information.",
          "You are responsible for activity on your account and for keeping login credentials secure.",
          "We may suspend or close accounts that abuse the platform, avoid payment, or create safety or fraud risks.",
        ],
      },
      {
        heading: "Bookings and payments",
        bullets: [
          "Bookings are only confirmed when payment has been authorised and FreeSpace shows a completed reservation.",
          "Pricing, duration, and any host-specific rules are shown before checkout.",
          "Drivers must ensure vehicle registration details are correct before arrival.",
        ],
      },
      {
        heading: "Liability and availability",
        paragraphs: [
          "Hosts are responsible for the accuracy of their listing details, access instructions, and availability.",
          "FreeSpace facilitates the booking transaction but does not guarantee that every host-controlled space will be uninterrupted, hazard free, or suitable for every vehicle.",
          "Except where liability cannot be excluded by law, drivers remain responsible for how and where they park, and hosts remain responsible for the spaces they control.",
        ],
      },
    ],
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    summary: "How FreeSpace collects, uses, stores, and shares personal data.",
    sections: [
      {
        heading: "Data we collect",
        bullets: [
          "Account details such as email, phone number, and login credentials.",
          "Booking data such as vehicle registration, reservation times, payment metadata, and support history.",
          "Device and usage data needed for security, fraud prevention, analytics, and notifications.",
        ],
      },
      {
        heading: "How we use data",
        bullets: [
          "To create and manage accounts, listings, and bookings.",
          "To process payments, refunds, support requests, and enforcement workflows where applicable.",
          "To detect fraud, protect hosts and drivers, and comply with legal obligations.",
        ],
      },
      {
        heading: "Sharing and retention",
        paragraphs: [
          "We share only the data required to fulfil bookings, process payments, provide support, and comply with legal obligations.",
          "We retain booking and payment records for as long as needed for operational, accounting, fraud, and legal purposes.",
        ],
      },
      {
        heading: "Your rights",
        bullets: [
          "You can request access, correction, deletion, or export of your data by contacting support.",
          "Where required by law, we will also support objection, restriction, and consent-withdrawal rights.",
        ],
      },
    ],
  },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    summary: "How cookies and similar technologies are used on the FreeSpace website.",
    sections: [
      {
        heading: "What we use cookies for",
        bullets: [
          "Authentication and session continuity.",
          "Security controls and abuse prevention.",
          "Remembering preferences and improving product performance.",
          "Website analytics and marketing only where permitted.",
        ],
      },
      {
        heading: "Cookie categories",
        bullets: [
          "Strictly necessary cookies required for site functionality.",
          "Performance and analytics cookies to understand site usage.",
          "Preference cookies that remember your settings.",
        ],
      },
      {
        heading: "Managing cookies",
        paragraphs: [
          "You can control cookies through your browser settings. Disabling strictly necessary cookies may affect core site features such as login and booking.",
        ],
      },
    ],
  },
  {
    slug: "refund-cancellation-policy",
    title: "Refund and Cancellation Policy",
    summary: "How booking cancellations, refunds, and dispute decisions are handled.",
    sections: [
      {
        heading: "Driver cancellations",
        bullets: [
          "Cancellation rights depend on the listing, time remaining before the booking starts, and whether the booking has already begun.",
          "Any refund amount shown at checkout or in booking details forms part of the booking terms.",
        ],
      },
      {
        heading: "Refund decisions",
        bullets: [
          "Refunds may be issued for duplicate charges, host-caused access failures, or other verified service failures.",
          "Refunds may be reduced or denied where the driver entered the wrong vehicle details, arrived outside the booked time, or breached listing rules.",
        ],
      },
      {
        heading: "Host cancellations",
        bullets: [
          "If a host cancels a confirmed booking and no suitable alternative is accepted, the booking should be canceled and refunded to the original payment method.",
          "Repeated host-side cancellations may lead to listing suspension or removal.",
        ],
      },
      {
        heading: "No-shows and overstays",
        bullets: [
          "Drivers who do not arrive for a valid booking may lose some or all of the booking amount where the cancellation window has already passed.",
          "Unauthorised overstays, parking outside the booked period, or parking outside the permitted area may lead to enforcement action and may reduce refund eligibility.",
        ],
      },
      {
        heading: "Processing times",
        paragraphs: [
          "Approved refunds are sent back to the original payment method. Bank processing times can vary after we submit the refund.",
        ],
      },
    ],
  },
  {
    slug: "host-terms",
    title: "Host Terms",
    summary: "The rules and responsibilities for hosts listing parking spaces on FreeSpace.",
    sections: [
      {
        heading: "Host responsibilities",
        bullets: [
          "Only list spaces you are authorised to offer.",
          "Keep location, access instructions, pricing, and availability accurate.",
          "Respond to operational issues quickly where host action is required.",
          "Maintain any insurance, property permissions, and site controls required for the space you list.",
        ],
      },
      {
        heading: "Payouts and fees",
        paragraphs: [
          "Host payouts are subject to payment processor requirements, chargebacks, platform fees, fraud checks, and refund adjustments.",
        ],
      },
      {
        heading: "Host compliance",
        bullets: [
          "Hosts must comply with local planning, parking, tax, and property rules.",
          "Repeated cancellations, inaccurate listings, or unsafe spaces can lead to listing suspension or removal.",
        ],
      },
    ],
  },
  {
    slug: "acceptable-use-policy",
    title: "Acceptable Use Policy",
    summary: "What users must not do when using FreeSpace.",
    sections: [
      {
        heading: "Prohibited behaviour",
        bullets: [
          "Fraudulent bookings, fake listings, false reviews, account sharing, or payment abuse.",
          "Attempts to bypass payment, enforcement, moderation, or security controls.",
          "Harassment, threats, discriminatory conduct, or misuse of support channels.",
          "Technical abuse such as scraping, reverse engineering, or interfering with platform availability.",
        ],
      },
      {
        heading: "Enforcement",
        paragraphs: [
          "We may remove content, restrict access, suspend listings, cancel bookings, or close accounts for policy breaches.",
        ],
      },
    ],
  },
  {
    slug: "community-guidelines",
    title: "Community and Review Guidelines",
    summary: "The standards for reviews, communication, and respectful platform use.",
    sections: [
      {
        heading: "Reviews",
        bullets: [
          "Reviews must be based on real booking experiences.",
          "Do not include threats, personal attacks, private information, or false claims.",
          "We may remove reviews that breach policy or appear manipulated.",
        ],
      },
      {
        heading: "Respectful conduct",
        bullets: [
          "Communicate clearly and honestly.",
          "Respect access instructions, neighbours, and property rules.",
          "Report genuine issues through support rather than retaliating through reviews.",
        ],
      },
    ],
  },
  {
    slug: "parking-terms-liability",
    title: "Parking Terms and Liability",
    summary: "The operating rules for using spaces booked through FreeSpace.",
    sections: [
      {
        heading: "Booking conditions",
        bullets: [
          "Drivers may only park during the booked period and in the booked bay or area.",
          "Vehicle registration details must match the vehicle using the booking.",
          "Drivers must follow all signage, access instructions, and safety directions at the site.",
        ],
      },
      {
        heading: "Vehicle and property risk",
        paragraphs: [
          "Unless required by law, parking is at the driver's own risk. FreeSpace acts as a marketplace and booking platform; hosts or operators remain responsible for the spaces they control.",
          "FreeSpace and hosts are not automatically responsible for loss, theft, or vehicle damage arising from matters outside their control.",
          "Nothing in these terms limits liability where exclusion is not permitted by applicable law.",
        ],
      },
    ],
  },
  {
    slug: "clamping-enforcement",
    title: "Clamping and Enforcement Policy",
    summary: "How site enforcement, unauthorised parking, and evidence handling work where enforcement is used.",
    sections: [
      {
        heading: "When enforcement may apply",
        bullets: [
          "If a site uses enforcement, relevant signage and listing details should explain that enforcement may apply.",
          "Unauthorised parking, overstays, invalid vehicle details, or parking outside the booked area may trigger enforcement action.",
          "FreeSpace may surface enforcement status and booking records, but the site owner, host, or authorised enforcement partner remains responsible for any physical enforcement action.",
        ],
      },
      {
        heading: "Evidence and disputes",
        bullets: [
          "Booking records, timestamps, payment status, vehicle registration details, and site reports may be used to review disputes.",
          "Drivers should contact support promptly if they believe enforcement was applied in error.",
        ],
      },
      {
        heading: "Important note",
        paragraphs: [
          "Enforcement arrangements vary by site and operator. Hosts and enforcement partners remain responsible for complying with applicable local law and signage requirements.",
        ],
      },
    ],
  },
  {
    slug: "data-processing-terms",
    title: "Data Processing Terms",
    summary: "Business-facing data handling terms for operator or enterprise customers.",
    sections: [
      {
        heading: "Roles",
        paragraphs: [
          "Where FreeSpace processes personal data on behalf of a business customer, the customer acts as controller and FreeSpace acts as processor except where FreeSpace determines its own purposes for security, billing, fraud, support, or legal compliance.",
        ],
      },
      {
        heading: "Processor commitments",
        bullets: [
          "Process personal data only on documented instructions, except where law requires otherwise.",
          "Use appropriate technical and organisational security controls.",
          "Assist with data subject requests, breach notifications, and deletion or return of data at the end of service where applicable.",
        ],
      },
      {
        heading: "Subprocessors",
        paragraphs: [
          "FreeSpace may use payment, hosting, analytics, messaging, and support subprocessors where needed to provide the service, subject to appropriate contractual safeguards.",
        ],
      },
    ],
  },
];

export function getLegalDoc(slug: string) {
  return LEGAL_DOCS.find((doc) => doc.slug === slug);
}
