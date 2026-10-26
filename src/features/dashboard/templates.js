import { newQuestion, newSection, QUIZ_DEFAULTS } from '../../lib/formModel.js'

function q(type, title, extra = {}) {
  return { ...newQuestion(type), title, ...extra }
}

function quizConfig(overrides = {}) {
  return {
    ...QUIZ_DEFAULTS,
    enabled: true,
    release: 'immediate',
    showMissed: true,
    showCorrect: true,
    showPoints: true,
    timeLimit: 0,
    ...overrides,
  }
}

const RECENT_KEY = 'peraform-recent-templates'

export function getRecentTemplateKeys() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list.slice(0, 6) : []
  } catch {
    return []
  }
}

export function saveRecentTemplateKey(key) {
  try {
    const existing = getRecentTemplateKeys().filter((k) => k !== key)
    const next = [key, ...existing].slice(0, 6)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked or unavailable
  }
}

// Starter templates on the dashboard and in the Template Gallery.
// Every build() returns fresh question IDs so two forms never share IDs.
export const TEMPLATES = [
  // ── Personal ────────────────────────────────────────────────
  {
    key: 'contact',
    name: 'Contact information',
    category: 'personal',
    theme: {
      color: 'indigo',
      background: 'light',
      font: 'inter',
      headerImage: { url: '/templates/contact.svg' },
    },
    build: () => ({
      title: 'Contact information',
      description: 'Let us know how to reach you.',
      theme: {
        color: 'indigo',
        background: 'light',
        font: 'inter',
        headerImage: { url: '/templates/contact.svg' },
      },
      questions: [
        q('shortText', 'Name', { required: true }),
        q('shortText', 'Email', { required: true }),
        q('shortText', 'Phone number'),
        q('longText', 'Address'),
        q('longText', 'Comments'),
      ],
    }),
  },
  {
    key: 'find-time',
    name: 'Find a time',
    category: 'personal',
    theme: {
      color: 'blue',
      background: 'light',
      font: 'inter',
      headerImage: { url: '/templates/find-time.svg' },
    },
    build: () => ({
      title: 'Find a time',
      description: 'Help us find the best time to meet.',
      theme: {
        color: 'blue',
        background: 'light',
        font: 'inter',
        headerImage: { url: '/templates/find-time.svg' },
      },
      questions: [
        q('shortText', 'Your name', { required: true }),
        q('checkboxes', 'What days work best for you?', {
          required: true,
          options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Weekend'],
        }),
        q('checkboxes', 'Preferred time of day', {
          required: true,
          options: ['Morning (9am–12pm)', 'Afternoon (12pm–4pm)', 'Evening (4pm–7pm)'],
        }),
        q('date', 'Earliest date you can meet'),
        q('longText', 'Anything else we should know?'),
      ],
    }),
  },
  {
    key: 'rsvp',
    name: 'Event RSVP',
    category: 'personal',
    theme: {
      color: 'amber',
      background: 'light',
      font: 'rounded',
      headerImage: { url: '/templates/rsvp.svg' },
    },
    build: () => ({
      title: 'Event RSVP',
      description: 'Let us know if you can make it.',
      theme: {
        color: 'amber',
        background: 'light',
        font: 'rounded',
        headerImage: { url: '/templates/rsvp.svg' },
      },
      questions: [
        q('shortText', 'Your name', { required: true }),
        q('multipleChoice', 'Can you attend?', {
          required: true,
          options: ['Yes, I’ll be there', 'Sorry, can’t make it'],
        }),
        q('dropdown', 'How many guests are you bringing?', {
          options: ['0', '1', '2', '3', '4+'],
        }),
        q('longText', 'Dietary requirements or comments'),
      ],
    }),
  },
  {
    key: 'party',
    name: 'Party invite',
    category: 'personal',
    theme: {
      color: 'pink',
      background: 'light',
      font: 'rounded',
      headerImage: { url: '/templates/party-invite.svg' },
    },
    build: () => ({
      title: 'Party invite',
      description: 'You’re invited! Let us know if you’ll join the celebration.',
      theme: {
        color: 'pink',
        background: 'light',
        font: 'rounded',
        headerImage: { url: '/templates/party-invite.svg' },
      },
      questions: [
        q('shortText', 'Name', { required: true }),
        q('multipleChoice', 'Will you be joining us?', {
          required: true,
          options: ['Count me in!', 'Wish I could, but have to miss it'],
        }),
        q('checkboxes', 'What can you bring?', {
          options: [
            'Appetizers / Finger food',
            'Main dish',
            'Dessert / Sweets',
            'Drinks / Beverages',
            'Ice / Cups / Plates',
          ],
        }),
        q('shortText', 'Favorite song request'),
        q('longText', 'Any food allergies or dietary notes?'),
      ],
    }),
  },
  {
    key: 'tshirt',
    name: 'T-shirt sign-up',
    category: 'personal',
    theme: {
      color: 'teal',
      background: 'light',
      font: 'inter',
      headerImage: { url: '/templates/tshirt.svg' },
    },
    build: () => ({
      title: 'T-shirt sign-up',
      description: 'Pick your shirt style and size.',
      theme: {
        color: 'teal',
        background: 'light',
        font: 'inter',
        headerImage: { url: '/templates/tshirt.svg' },
      },
      questions: [
        q('shortText', 'Name', { required: true }),
        q('shortText', 'Email', { required: true }),
        q('multipleChoice', 'Shirt size', {
          required: true,
          options: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
        }),
        q('multipleChoice', 'Preferred color', {
          required: true,
          options: ['Midnight Navy', 'Heather Grey', 'Forest Green', 'Classic Black'],
        }),
        q('dropdown', 'Delivery preference', {
          options: ['Pick up in person', 'Ship to address'],
        }),
        q('longText', 'Shipping address (if delivering)'),
      ],
    }),
  },
  {
    key: 'registration',
    name: 'Event registration',
    category: 'personal',
    theme: {
      color: 'indigo',
      background: 'light',
      font: 'inter',
      headerImage: { url: '/templates/event-registration.svg' },
    },
    build: () => ({
      title: 'Event registration',
      description: 'Register to reserve your spot at the upcoming event.',
      theme: {
        color: 'indigo',
        background: 'light',
        font: 'inter',
        headerImage: { url: '/templates/event-registration.svg' },
      },
      questions: [
        q('shortText', 'Full name', { required: true }),
        q('shortText', 'Email address', { required: true }),
        q('shortText', 'Organization / Company'),
        q('multipleChoice', 'Ticket type', {
          required: true,
          options: ['General admission', 'VIP pass', 'Student / Non-profit'],
        }),
        q('checkboxes', 'Which sessions will you attend?', {
          options: [
            'Keynote & Opening remarks',
            'Morning workshop tracks',
            'Networking lunch',
            'Afternoon panel discussion',
            'Evening reception',
          ],
        }),
        q('longText', 'Special accommodations or accessibility needs'),
      ],
    }),
  },

  // ── Work ────────────────────────────────────────────────────
  {
    key: 'event-feedback',
    name: 'Event feedback',
    category: 'work',
    theme: {
      color: 'blue',
      background: 'light',
      font: 'inter',
      headerImage: { url: '/templates/event-feedback.svg' },
    },
    build: () => ({
      title: 'Event feedback',
      description: 'Tell us how the event went so we can make the next one even better.',
      theme: {
        color: 'blue',
        background: 'light',
        font: 'inter',
        headerImage: { url: '/templates/event-feedback.svg' },
      },
      questions: [
        q('rating', 'Overall, how would you rate this event?', { required: true, max: 5 }),
        q('mcGrid', 'Session feedback', {
          rows: ['Keynote speaker', 'Workshops', 'Venue & Logistics', 'Networking time'],
          columns: ['Poor', 'Fair', 'Good', 'Excellent'],
        }),
        q('longText', 'What was the highlight of the event for you?'),
        q('longText', 'What could we improve for next time?'),
        q('linearScale', 'How likely are you to recommend this event to a colleague?', {
          min: 1,
          max: 10,
          minLabel: 'Not likely',
          maxLabel: 'Extremely likely',
        }),
      ],
    }),
  },
  {
    key: 'order-form',
    name: 'Order form',
    category: 'work',
    theme: {
      color: 'green',
      background: 'light',
      font: 'inter',
      headerImage: { url: '/templates/order-form.svg' },
    },
    build: () => ({
      title: 'Order form',
      description: 'Submit your product or merchandise order.',
      theme: {
        color: 'green',
        background: 'light',
        font: 'inter',
        headerImage: { url: '/templates/order-form.svg' },
      },
      questions: [
        q('shortText', 'Customer name', { required: true }),
        q('shortText', 'Contact email', { required: true }),
        q('shortText', 'Phone number'),
        q('checkboxes', 'Item selection', {
          required: true,
          options: ['Standard Kit — $25', 'Deluxe Package — $50', 'Annual Refill Bundle — $80'],
        }),
        q('dropdown', 'Quantity', {
          required: true,
          options: ['1', '2', '3', '4', '5+'],
        }),
        q('date', 'Requested delivery date'),
        q('longText', 'Shipping address', { required: true }),
        q('longText', 'Special delivery instructions'),
      ],
    }),
  },
  {
    key: 'job-application',
    name: 'Job application',
    category: 'work',
    theme: {
      color: 'indigo',
      background: 'light',
      font: 'inter',
      headerImage: { url: '/templates/job-application.svg' },
    },
    build: () => ({
      title: 'Job application',
      description: 'Join our team! Complete the details below to apply.',
      theme: {
        color: 'indigo',
        background: 'light',
        font: 'inter',
        headerImage: { url: '/templates/job-application.svg' },
      },
      questions: [
        q('shortText', 'Full name', { required: true }),
        q('shortText', 'Email address', { required: true }),
        q('shortText', 'Phone number', { required: true }),
        q('dropdown', 'Position applying for', {
          required: true,
          options: [
            'Software Engineer',
            'Product Designer',
            'Customer Success Lead',
            'Marketing Specialist',
            'Operations Manager',
          ],
        }),
        q('date', 'Earliest available start date'),
        q('multipleChoice', 'Years of relevant experience', {
          required: true,
          options: ['0–1 years', '2–4 years', '5–7 years', '8+ years'],
        }),
        q('shortText', 'Portfolio or LinkedIn URL'),
        q('fileUpload', 'Resume / CV', {
          required: true,
          accept: ['pdf', 'document'],
          maxFiles: 1,
          maxSizeMb: 10,
        }),
        q('longText', 'Why are you interested in this role?'),
      ],
    }),
  },
  {
    key: 'time-off',
    name: 'Time-off request',
    category: 'work',
    theme: {
      color: 'teal',
      background: 'light',
      font: 'inter',
      headerImage: { url: '/templates/time-off.svg' },
    },
    build: () => ({
      title: 'Time-off request',
      description: 'Request vacation, sick leave, or personal time off.',
      theme: {
        color: 'teal',
        background: 'light',
        font: 'inter',
        headerImage: { url: '/templates/time-off.svg' },
      },
      questions: [
        q('shortText', 'Employee name', { required: true }),
        q('dropdown', 'Department', {
          required: true,
          options: ['Engineering', 'Design', 'Marketing', 'Sales', 'Finance', 'Operations'],
        }),
        q('multipleChoice', 'Type of leave', {
          required: true,
          options: ['Paid vacation (PTO)', 'Sick leave', 'Parental leave', 'Bereavement', 'Unpaid leave'],
        }),
        q('date', 'Start date', { required: true }),
        q('date', 'End date', { required: true }),
        q('shortText', 'Colleague covering key duties'),
        q('longText', 'Additional notes or handover details'),
      ],
    }),
  },
  {
    key: 'work-request',
    name: 'Work request',
    category: 'work',
    theme: {
      color: 'slate',
      background: 'light',
      font: 'inter',
      headerImage: { url: '/templates/work-request.svg' },
    },
    build: () => ({
      title: 'Work request',
      description: 'Submit a project, task, or maintenance request.',
      theme: {
        color: 'slate',
        background: 'light',
        font: 'inter',
        headerImage: { url: '/templates/work-request.svg' },
      },
      questions: [
        q('shortText', 'Requester name', { required: true }),
        q('shortText', 'Department / Team', { required: true }),
        q('shortText', 'Request title / Summary', { required: true }),
        q('multipleChoice', 'Priority level', {
          required: true,
          options: ['Low — when time permits', 'Medium — standard turnaround', 'High — urgent deadline', 'Critical — blocker'],
        }),
        q('date', 'Target completion date', { required: true }),
        q('longText', 'Detailed description and requirements', { required: true }),
        q('fileUpload', 'Attachments / References', {
          accept: [],
          maxFiles: 5,
          maxSizeMb: 10,
        }),
      ],
    }),
  },
  {
    key: 'customer-feedback',
    name: 'Customer feedback',
    category: 'work',
    theme: {
      color: 'amber',
      background: 'light',
      font: 'inter',
      headerImage: { url: '/templates/customer-feedback.svg' },
    },
    build: () => ({
      title: 'Customer feedback',
      description: 'Help us understand how we’re doing and how we can serve you better.',
      theme: {
        color: 'amber',
        background: 'light',
        font: 'inter',
        headerImage: { url: '/templates/customer-feedback.svg' },
      },
      questions: [
        q('multipleChoice', 'How long have you been using our service?', {
          options: ['Under a month', '1–6 months', '6–12 months', 'Over a year'],
        }),
        q('linearScale', 'How satisfied are you with our product overall?', {
          required: true,
          min: 1,
          max: 5,
          minLabel: 'Very unsatisfied',
          maxLabel: 'Very satisfied',
        }),
        q('mcGrid', 'Rate our key attributes', {
          rows: ['Ease of use', 'Reliability', 'Customer support', 'Value for money'],
          columns: ['Poor', 'Fair', 'Good', 'Excellent'],
        }),
        q('shortText', 'What feature do you use the most?'),
        q('longText', 'What would you like to see added or improved?'),
        q('multipleChoice', 'May we contact you for follow-up questions?', {
          options: ['Yes', 'No'],
        }),
      ],
    }),
  },

  // ── Education ───────────────────────────────────────────────
  {
    key: 'blank-quiz',
    name: 'Blank quiz',
    category: 'education',
    theme: {
      color: 'indigo',
      background: 'light',
      font: 'inter',
      headerImage: { url: '/templates/blank-quiz.svg' },
    },
    build: () => ({
      title: 'Blank quiz',
      description: 'A starter quiz with automated grading and score release.',
      theme: {
        color: 'indigo',
        background: 'light',
        font: 'inter',
        headerImage: { url: '/templates/blank-quiz.svg' },
      },
      settings: {
        quiz: quizConfig(),
      },
      questions: [
        q('multipleChoice', 'Sample question', {
          required: true,
          points: 10,
          options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        }),
      ],
    }),
  },
  {
    key: 'exit-ticket',
    name: 'Exit ticket',
    category: 'education',
    theme: {
      color: 'green',
      background: 'light',
      font: 'rounded',
      headerImage: { url: '/templates/exit-ticket.svg' },
    },
    build: () => ({
      title: 'Exit ticket',
      description: 'A quick check for understanding at the end of class.',
      theme: {
        color: 'green',
        background: 'light',
        font: 'rounded',
        headerImage: { url: '/templates/exit-ticket.svg' },
      },
      settings: {
        quiz: quizConfig(),
      },
      questions: [
        q('shortText', 'Student name', { required: true }),
        q('longText', 'What was the key concept you learned today?', { required: true }),
        q('multipleChoice', 'Check your understanding: which statement is accurate?', {
          required: true,
          points: 5,
          options: ['Statement A is accurate', 'Statement B is inaccurate', 'Statement C is incomplete', 'None of the above'],
        }),
        q('linearScale', 'How confident do you feel about today’s topic?', {
          required: true,
          min: 1,
          max: 5,
          minLabel: 'Still unsure',
          maxLabel: 'Very confident',
        }),
        q('longText', 'What questions or topics do you want to revisit next class?'),
      ],
    }),
  },
  {
    key: 'assessment',
    name: 'Assessment',
    category: 'education',
    theme: {
      color: 'blue',
      background: 'light',
      font: 'inter',
      headerImage: { url: '/templates/assessment.svg' },
    },
    build: () => ({
      title: 'Unit assessment',
      description: 'Comprehensive evaluation across key unit concepts.',
      theme: {
        color: 'blue',
        background: 'light',
        font: 'inter',
        headerImage: { url: '/templates/assessment.svg' },
      },
      settings: {
        quiz: quizConfig({ timeLimit: 30 }),
      },
      questions: [
        q('shortText', 'Student full name', { required: true }),
        q('shortText', 'Student ID number', { required: true }),
        newSection(),
        q('multipleChoice', 'Question 1: Primary governing mechanism', {
          required: true,
          points: 10,
          options: ['Primary factor', 'Secondary contributor', 'Tertiary variable', 'Null hypothesis'],
        }),
        q('checkboxes', 'Question 2: Select all applicable principles', {
          required: true,
          points: 10,
          options: ['Conservation of momentum', 'Thermal equilibrium', 'Linear decay', 'Inductive resonance'],
        }),
        q('dropdown', 'Question 3: Foundational axiom classification', {
          required: true,
          points: 10,
          options: ['Hypothesis', 'Theorem', 'Axiom', 'Corollary'],
        }),
        q('shortText', 'Question 4: Define the core phenomenon in one sentence', {
          required: true,
          points: 10,
        }),
        q('longText', 'Question 5: Explain the implications of the primary model'),
      ],
    }),
  },
  {
    key: 'worksheet',
    name: 'Worksheet',
    category: 'education',
    theme: {
      color: 'teal',
      background: 'light',
      font: 'mono',
      headerImage: { url: '/templates/worksheet.svg' },
    },
    build: () => ({
      title: 'Practice worksheet',
      description: 'Guided practice problems and exercise questions.',
      theme: {
        color: 'teal',
        background: 'light',
        font: 'mono',
        headerImage: { url: '/templates/worksheet.svg' },
      },
      settings: {
        quiz: quizConfig(),
      },
      questions: [
        q('shortText', 'Student name', { required: true }),
        q('shortText', 'Problem 1: Calculate the baseline value', {
          required: true,
          points: 5,
        }),
        q('multipleChoice', 'Problem 2: Select the matching formula', {
          required: true,
          points: 5,
          options: ['Formula A (linear)', 'Formula B (quadratic)', 'Formula C (exponential)', 'Formula D (logarithmic)'],
        }),
        q('shortText', 'Problem 3: Intermediate computation result', {
          required: true,
          points: 5,
        }),
        q('longText', 'Problem 4: Show your detailed step-by-step solution', {
          required: true,
        }),
        q('rating', 'Self-reflection: rate the difficulty of this exercise set', { max: 5 }),
      ],
    }),
  },
  {
    key: 'course-eval',
    name: 'Course evaluation',
    category: 'education',
    theme: {
      color: 'pink',
      background: 'light',
      font: 'rounded',
      headerImage: { url: '/templates/course-eval.svg' },
    },
    build: () => ({
      title: 'Course evaluation',
      description: 'Share your feedback to help us refine the curriculum and teaching.',
      theme: {
        color: 'pink',
        background: 'light',
        font: 'rounded',
        headerImage: { url: '/templates/course-eval.svg' },
      },
      questions: [
        q('shortText', 'Course name and section', { required: true }),
        q('shortText', 'Instructor name'),
        q('rating', 'Overall rating of the course content and delivery', { required: true, max: 5 }),
        q('mcGrid', 'Evaluation of course components', {
          rows: ['Course materials & readings', 'Instructor clarity & responsiveness', 'Assignments & pacing', 'Grading fairness'],
          columns: ['Needs work', 'Acceptable', 'Good', 'Outstanding'],
        }),
        q('longText', 'What aspect of the course was most valuable to you?'),
        q('longText', 'What suggestions do you have for improving future iterations of this course?'),
      ],
    }),
  },
]
