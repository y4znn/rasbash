import { e, pageUrl } from './records.js';

export function advisoryPage(catalog, params) {
  const profile = catalog.profiles.find(item => item.slug === params.get('corridor'));
  const section = profile?.sections.find(item => item.id === params.get('section'));
  const context = profile ? pageUrl(profile) + (section ? '?section=' + encodeURIComponent(section.id) + '#section-' + encodeURIComponent(section.id) : '') : '';
  const title = profile ? profile.name + (section ? ' / ' + section.title : '') : '';
  return `<article class="advisory-office">
    <header class="office-intro"><p class="office-kicker">RASBASH Communications</p>
      <h1>Corridor advisory</h1><p class="office-deck">We advise on the politics of economic corridors and how to communicate decisions across borders.</p>
    </header>
    <div class="office-columns">
      <div class="office-services"><h2>How we can advise</h2>
        <section><h3>Political judgement</h3><p>When a route crosses jurisdictions, we identify who controls access and which agreements a decision depends on.</p></section>
        <section><h3>Communications counsel</h3><p>We help clients prepare for negotiations, public announcements and questions from the press. Our advice distinguishes commitments from the work still ahead.</p></section>
      </div>
      <section class="office-form" id="enquiry"><h2>Discuss an assignment</h2>
        <form action="/api/enquiries" method="post" id="advisory-form">
          ${context ? '<p class="office-context">Regarding <a href="' + e(context) + '">' + e(title) + '</a></p>' : ''}
          <input type="hidden" name="context" value="${e(context)}">
          <input type="hidden" name="request_id" value="">
          <label>What would you like advice on?<textarea name="question" required maxlength="3500" rows="4"></textarea></label>
          <label>Your email<input name="reply" type="email" autocomplete="email" maxlength="254" required></label>
          <button class="office-send" type="submit">Send enquiry</button><p class="office-status" role="status" aria-live="polite"></p>
        </form>
      </section>
    </div>
  </article>`;
}
