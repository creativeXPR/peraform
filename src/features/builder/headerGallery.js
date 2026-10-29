// The "Select header" gallery: PeraForm's own header art (public/headers
// and the template headers in public/templates), by category.
const art = (folder, names) => names.map(([file, label]) => ({ url: `/${folder}/${file}.svg`, label }))

export const HEADER_GALLERY = [
  {
    key: 'abstract',
    label: 'Abstract',
    images: art('headers', [
      ['waves-ocean', 'Ocean waves'],
      ['waves-sunset', 'Sunset waves'],
      ['waves-forest', 'Forest waves'],
      ['blobs-aurora', 'Aurora'],
      ['blobs-pastel', 'Pastel glow'],
      ['blobs-indigo', 'Indigo glow'],
      ['dots-night', 'Night dots'],
      ['dots-sand', 'Sand dots'],
      ['stripes-teal', 'Teal stripes'],
      ['stripes-plum', 'Plum stripes'],
    ]),
  },
  {
    key: 'landscapes',
    label: 'Landscapes',
    images: art('headers', [
      ['peaks-dawn', 'Mountains at dawn'],
      ['peaks-dusk', 'Mountains at dusk'],
    ]),
  },
  {
    key: 'work',
    label: 'Work and school',
    images: art('templates', [
      ['assessment', 'Assessment'],
      ['course-eval', 'Course evaluation'],
      ['exit-ticket', 'Exit ticket'],
      ['worksheet', 'Worksheet'],
      ['blank-quiz', 'Quiz'],
      ['job-application', 'Job application'],
      ['work-request', 'Work request'],
      ['time-off', 'Time off'],
      ['order-form', 'Order form'],
      ['customer-feedback', 'Customer feedback'],
    ]),
  },
  {
    key: 'events',
    label: 'Events and people',
    images: art('templates', [
      ['rsvp', 'RSVP'],
      ['party-invite', 'Party'],
      ['event-registration', 'Registration'],
      ['event-feedback', 'Event feedback'],
      ['find-time', 'Find a time'],
      ['tshirt', 'T-shirts'],
      ['contact', 'Contact'],
    ]),
  },
]
