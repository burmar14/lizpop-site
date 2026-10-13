# lizpop.art

Liz Karcewski's website. Hosted free on GitHub Pages. The domain is registered at WordPress.com.

## Editing the site (no code needed)

Go to **https://lizpop.art/admin/** and sign in.

| Section | What it controls |
|---|---|
| Quotes | The daily quote on the home page. Add, edit, reorder, or turn one off with "Show on site." |
| Prints | The print wall. Each print links to its Etsy listing. |
| Brand portfolio | Projects at lizpop.art/portfolio. Turn on "Feature on home page" for up to 3. |
| Page text and links | Home page text, book details and buy links, the book signing, brand stats, About, social links. |

Every save becomes a commit in this repo, so nothing is ever truly lost. Changes go live in about 1 to 2 minutes.

### Signing in

Each person needs a GitHub account with access to this repo:

1. Mark adds Liz under **Settings > Collaborators** in the repo.
2. On the admin login screen, click **Sign In with Token**. It links to GitHub with the right settings filled in.
3. If making the token by hand, use a **fine-grained token**, limited to only the `lizpop-site` repo, with **Contents: Read and write**.
4. Paste the token once. The browser remembers it. Don't share tokens; each person makes their own.

### Images

- Uploads are automatically resized and converted to WebP so the site stays fast.
- Always fill in the image description. It's what screen readers read aloud.
- Print images currently link to Etsy's photos. If one ever breaks, upload the image directly instead.

### Videos

Don't upload video files to the repo; GitHub isn't built for large files.

- YouTube, YouTube Shorts, and Vimeo links play right on the site.
- Instagram and TikTok links open in a new tab (their embeds slow pages down and track visitors).
- For each video, upload a cover image (a screenshot from the video works).

## Files

- `index.html` home page, `portfolio/index.html` brand portfolio, `404.html` not-found page
- `content/*.json` all editable content (what the admin panel edits)
- `assets/site.css`, `assets/site.js` styles and page logic
- `admin/` the admin panel (Sveltia CMS) and its settings in `config.yml`
- `images/uploads/` everything uploaded through the admin panel
- `CNAME` keeps the lizpop.art domain connected. Don't delete it.
