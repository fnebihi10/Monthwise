# Design direction — the personal ledger

Working brand: Monthwise. English first; Albanian can be added without changing data structures.

## Character

An editorial household ledger: warm paper, sharp rules, generous space, expressive serif month titles and restrained modern numerical typography. Burnt orange provides emphasis; olive identifies retained income. No gradients, glass panels, oversized rounded cards or decorative finance illustrations.

## Palette

- Paper #f4f1e9
- Ink #282923
- Muted ink #716f65
- Rule #dcd8cd
- Burnt orange #b4472c
- Olive ink #535c42
- Note paper #eae2d3

## Typography

Georgia for month names and editorial headings. Manrope for key amounts and the wordmark. DM Sans for interface copy. Google Fonts currently supplies the optional sans fonts; system fallbacks work if unavailable. Evaluate self-hosted font files before production/offline release.

## Composition

- Compact wordmark and quiet utility header.
- A numbered 12-month index, horizontally scrollable on phones.
- One large month title.
- A continuous three-part financial summary, not unrelated metric cards.
- Primary transaction ledger with an adjacent spending breakdown and useful explanatory note.
- Two meaningful views: month and year. Avoid dead navigation links.

## Interaction and accessibility

Native buttons, table headers, dialog and labelled forms. Visible focus, non-color status labels, descriptive amounts and empty states. All essential actions must remain accessible on phones; text inputs use 16px to avoid iPhone form zoom. Verify contrast and touch targets in Sprint 5, expanding controls where necessary.
