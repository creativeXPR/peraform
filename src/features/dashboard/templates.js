import { newQuestion } from '../../lib/formModel.js'

function q(type, title, extra = {}) {
  return { ...newQuestion(type), title, ...extra }
}

// Starter templates on the dashboard. Each build() returns fresh question
// ids, so two forms made from the same template never share ids.
export const TEMPLATES = [
  {
    key: 'contact',
    name: 'Contact information',
    build: () => ({
      title: 'Contact information',
      description: 'Let us know how to reach you.',
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
    key: 'rsvp',
    name: 'Event RSVP',
    build: () => ({
      title: 'Event RSVP',
      description: 'Let us know if you can make it.',
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
]
