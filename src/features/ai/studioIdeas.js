import {
  AlertTriangle,
  AlignCenter,
  Building2,
  Columns2,
  Gamepad2,
  GraduationCap,
  Grid3x3,
  ImagePlus,
  Languages,
  Layers,
  ListChecks,
  ListOrdered,
  Mail,
  MessageSquareText,
  Moon,
  Palette,
  PartyPopper,
  PenLine,
  Scissors,
  Smile,
  Sun,
  Target,
  TrendingDown,
  Type,
} from 'lucide-react'

// Illustrated ideas for the AI windows other than Create (AiStudio.jsx):
// a short card title, the prompt it fills in, and the picture's colours
// and icon (IdeaArt.jsx).
const C = {
  peach: { sky: '#fff1dc', sky2: '#ffd9b0', ground: '#f4b183', accent: '#e8743b' },
  sky: { sky: '#e3f2ff', sky2: '#b9ddff', ground: '#7fc0f2', accent: '#2f80d1' },
  mint: { sky: '#eaf7e4', sky2: '#c8ecb8', ground: '#8fcf72', accent: '#3e9b3a' },
  indigo: { sky: '#eef0ff', sky2: '#d3d8ff', ground: '#a3acf5', accent: '#4f46e5' },
  rose: { sky: '#fff0f4', sky2: '#ffd1de', ground: '#f6a5bd', accent: '#d9467a' },
  violet: { sky: '#f3ecff', sky2: '#ddcdff', ground: '#b79cf5', accent: '#7c3aed' },
  gold: { sky: '#fff7e0', sky2: '#ffe8a8', ground: '#f2cf6a', accent: '#c58a06' },
  teal: { sky: '#e2f7f4', sky2: '#b8ebe3', ground: '#71cdbf', accent: '#0f8a7a' },
  red: { sky: '#ffeceb', sky2: '#ffcdca', ground: '#f59c95', accent: '#d64541' },
}

// Edit with AI: changes to the form you're in.
export const EDIT_IDEAS = [
  { key: 'email', title: 'Add a required email question', prompt: 'Add an email question after the name, and make it required', art: C.sky, icon: Mail },
  { key: 'grid', title: 'Turn ratings into one grid', prompt: 'Turn the satisfaction questions into one grid', art: C.indigo, icon: Grid3x3 },
  { key: 'translate', title: 'Translate the whole form', prompt: 'Translate the whole form into French', art: C.teal, icon: Languages },
  { key: 'friendly', title: 'Friendlier, shorter wording', prompt: 'Make the wording friendlier and shorter', art: C.peach, icon: Smile },
  { key: 'required', title: 'Make key questions required', prompt: 'Make every contact-detail question required', art: C.mint, icon: ListChecks },
  { key: 'trim', title: 'Cut repeated questions', prompt: 'Remove questions that ask the same thing twice, keeping the clearer one', art: C.red, icon: Scissors },
  { key: 'sections', title: 'Split it into sections', prompt: 'Group the questions into sensible sections with short titles', art: C.violet, icon: Layers },
  { key: 'order', title: 'Put questions in a better order', prompt: 'Reorder the questions so easy ones come first and personal details come last', art: C.gold, icon: ListOrdered },
  { key: 'other', title: 'Add an “Other” option', prompt: 'Add an “Other” option to every multiple-choice question where it makes sense', art: C.rose, icon: MessageSquareText },
]

// Design with AI → This screen: layout changes on one screen.
export const SCREEN_IDEAS = [
  { key: 'centre', title: 'Centre it, bigger heading', prompt: 'Centre everything and make the heading bigger', art: C.indigo, icon: AlignCenter },
  { key: 'image', title: 'Add an image above the heading', prompt: 'Add an image above the heading', art: C.peach, icon: ImagePlus },
  { key: 'buttons', title: 'Buttons side by side', prompt: 'Put the buttons side by side at the bottom', art: C.mint, icon: Columns2 },
  { key: 'glass', title: 'A glassy card on purple', prompt: 'Make the card glassy on a purple gradient', art: C.violet, icon: Palette },
  { key: 'font', title: 'A friendlier font', prompt: 'Use the friendly rounded font for all the text on this screen', art: C.rose, icon: Type },
  { key: 'space', title: 'More breathing room', prompt: 'Add more space between the blocks and round the card corners', art: C.teal, icon: Layers },
]

// Design with AI → All screens: a look for every screen.
export const STYLE_IDEAS = [
  { key: 'party', title: 'Fun and colourful', prompt: 'Fun and colourful, for a kids’ party', art: C.rose, icon: PartyPopper },
  { key: 'formal', title: 'Formal, for a quality office', prompt: 'Formal, for a university quality office', art: C.sky, icon: Building2 },
  { key: 'school', title: 'Calm and clear, for school', prompt: 'Calm and clear, for a school quiz', art: C.mint, icon: GraduationCap },
  { key: 'tech', title: 'Dark and techy', prompt: 'Dark and techy, for a hackathon', art: C.violet, icon: Gamepad2 },
  { key: 'warm', title: 'Warm and welcoming', prompt: 'Warm and welcoming, in our brand orange', art: C.peach, icon: Sun },
  { key: 'night', title: 'Elegant night theme', prompt: 'Elegant dark blue, for an awards night', art: C.indigo, icon: Moon },
]

// Analyse results: what the report should focus on.
export const ANALYSE_IDEAS = [
  { key: 'rewrite', title: 'Which questions to rewrite', prompt: 'Which questions should I rewrite, and why?', art: C.peach, icon: PenLine },
  { key: 'hard', title: 'Too hard or too easy?', prompt: 'Which questions were too hard or too easy?', art: C.sky, icon: TrendingDown },
  { key: 'problems', title: 'Spot possible mistakes', prompt: 'Are any answer keys or options likely wrong?', art: C.red, icon: AlertTriangle },
  { key: 'takeaways', title: 'Three key takeaways', prompt: 'Give me the three most important takeaways', art: C.mint, icon: Target },
]
