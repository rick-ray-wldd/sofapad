# SofaPad logo

**Sofa Mode On ｜ ON 沙發**: the sofa's seat cushion is a pill switch turned on. Flip it, and the Mac is in sofa mode.

| File | What it is |
|---|---|
| `sofapad-lockup-light.svg` | Logo (sofa + wordmark) for **light** backgrounds: blue sofa, ink wordmark |
| `sofapad-lockup-dark.svg` | Logo for **dark** backgrounds: lighter blue sofa, white wordmark |
| `sofapad-icon.svg` | Icon: white sofa on a blue rounded square |
| `sofapad-icon-1024.png` | The icon as a 1024 × 1024 PNG (transparent corners) |
| `social-preview.png` | 1280 × 640 card for the repository's social preview: the logo and the tagline on blue |

The SVGs are plain shapes: the wordmark is outlined (no font needed), and the switch's knob is a hole cut with an
even-odd fill, so the background shows through it. No metadata, ids or comments.

## Colors

| Name | Hex | Used for |
|---|---|---|
| Switch Blue | `#2D5BFF` | the sofa on light backgrounds, the icon's background, the social preview |
| Switch Blue on dark | `#6B8CFF` | the sofa on dark backgrounds |
| Ink | `#0B1530` | the wordmark on light backgrounds |
| Mist | `#EEF1F6` | light surfaces, secondary text on blue |
| White | `#FFFFFF` | the wordmark on dark backgrounds, the sofa in the icon |

## Type

- Wordmark: **Unbounded** SemiBold (600), © 2022 The Unbounded Project Authors, under the
  [SIL Open Font License 1.1](https://openfontlicense.org). Source:
  [google/fonts `ofl/unbounded`](https://github.com/google/fonts/tree/main/ofl/unbounded). The SVGs carry it as
  outlines, so they do not embed or need the font.
- Tagline on the social preview: **Space Grotesk** (400 and 600, © 2020 The Space Grotesk Project Authors, SIL OFL 1.1,
  [google/fonts `ofl/spacegrotesk`](https://github.com/google/fonts/tree/main/ofl/spacegrotesk)).

## Using it

- Keep the knob cut out of the seat: it is what makes the sofa a switch. Do not recolor the switch iOS green.
- Use the light lockup on light backgrounds and the dark one on dark backgrounds; in Markdown on GitHub, a `<picture>`
  with `prefers-color-scheme` picks the right one (see the top of the README).
- Leave clear space around the logo of at least the height of the back cushion.
- The app and the phone page keep their current icons for now; the logo is used for the README and the repository.
