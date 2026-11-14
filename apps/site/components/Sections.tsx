// The page's sections, in order. All Server Components: the only client code
// is the figure islands, the copy buttons and the mobile menu.
import type { CSSProperties, ReactNode } from 'react';
import { microcopy, type Copy, type TwoTone } from '../content/copy';
import { facts } from '../content/facts';
import { demoLines } from '../lib/strkey-demo';
import { site } from '../site.config';
import { Canvas, FigureFrame } from './figures/Frame';
import { ResponsiveStill } from './figures/FourChecks/Scene';
import { STILL_STEPS } from './figures/FourChecks/model';
import { ChecksIsland, NormalizeIsland, VerifyIsland } from './figures/Island';
import { NormalizeStill } from './figures/Normalize/Still';
import { OperatorSchematic } from './figures/OperatorSchematic';
import { VerifyStill, type VerifyData } from './figures/Verify/Still';
import figureStyles from './figures/figures.module.css';
import { ExternalIcon } from './icons';
import { Button, Card, Chip, CodeBlock, Eyebrow, TwoToneText } from './ui';
import styles from './Sections.module.css';

/** Position in a staggered reveal. */
const at = (i: number) => ({ '--i': i }) as CSSProperties;

function Section({
  id,
  children,
  className = '',
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`${styles.section} ${className}`}>
      <div className="container">{children}</div>
    </section>
  );
}

function SectionHead({
  id,
  eyebrow,
  title,
  lead,
}: {
  id: string;
  eyebrow: string;
  title: TwoTone | string;
  lead?: string;
}) {
  return (
    // With a lead, the head splits on desktop: headline left, lead right.
    <div className={`${styles.head} ${lead ? styles.headSplit : ''}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={`${id}-title`} className="h2">
        <TwoToneText title={title} />
      </h2>
      {lead ? <p className="lead">{lead}</p> : null}
    </div>
  );
}

function EnrollButton({ copy, event }: { copy: Copy; event: string }) {
  return (
    <Button href={site.signupUrl} event={event} opens={microcopy.opensApp}>
      {copy.enroll}
    </Button>
  );
}

function RepoButton({ label }: { label: string }) {
  return (
    <Button href={site.repoUrl} variant="secondary" event="outbound-github" opens={microcopy.opensGitHub} external>
      {label}
      <ExternalIcon />
    </Button>
  );
}

/** A short title or sentence with a mono detail, used in several sections. */
function DetailRow({ title, text, detail, i }: { title?: string; text: string; detail: string; i: number }) {
  return (
    <div className={styles.row}>
      <dt className={title ? 'h3' : styles.rowSentence} data-reveal style={at(i)}>
        {title ?? text}
      </dt>
      {title ? (
        <dd className={styles.rowText} data-reveal style={at(i)}>
          {text}
        </dd>
      ) : null}
      {/* The mono detail does not move: it only fades in. */}
      <dd className={`mono ${styles.rowDetail}`} data-reveal="fade" style={at(i)}>
        {detail}
      </dd>
    </div>
  );
}

/* 7.1 Hero */
export function Hero({ copy }: { copy: Copy }) {
  const { hero } = copy;
  const lead = hero.title.lead.split(' ');
  const rest = hero.title.rest.split(' ');
  const word = (text: string, i: number) => (
    <span key={i} className={styles.word} style={at(i)}>
      {text}
    </span>
  );
  return (
    <section id="top" aria-labelledby="top-title" className={styles.hero}>
      <div className={`container ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <div className={styles.heroAfter}>
            <Eyebrow>{hero.eyebrow}</Eyebrow>
          </div>
          {/* One h1. Each word is its own span so it can enter on its own, from first paint. */}
          <h1 id="top-title" className={styles.h1}>
            <span className={styles.h1Line}>
              {lead.map((text, i) => [word(text, i), ' '])}
            </span>
            <span className={`accent ${styles.h1Line}`}>
              {rest.map((text, i) => [word(text, lead.length + i), i < rest.length - 1 ? ' ' : null])}
            </span>
          </h1>
          <div className={styles.heroAfter}>
            <p className="lead">{hero.lead}</p>
            <div className={styles.ctas}>
              <EnrollButton copy={copy} event="cta-enroll-hero" />
              <Button href="#checks" variant="secondary">
                {hero.secondary}
              </Button>
            </div>
            <p className="small">{hero.micro}</p>
          </div>
        </div>

        <FigureFrame label={hero.figure.label} caption={hero.figure.caption} className={styles.heroFigure}>
          <ChecksIsland labels={hero.figure} aria={hero.figure.aria}>
            <Canvas label={hero.figure.aria} className={figureStyles.checks}>
              <ResponsiveStill labels={hero.figure} steps={STILL_STEPS} />
            </Canvas>
          </ChecksIsland>
        </FigureFrame>
      </div>
    </section>
  );
}

/* 7.2 Bot and inflation defense */
export function Checks({ copy }: { copy: Copy }) {
  const c = copy.checks;
  return (
    <Section id="checks">
      <SectionHead id="checks" eyebrow={c.eyebrow} title={c.title} lead={c.lead} />
      <ol className={styles.cards}>
        {c.cards.map((card, i) => (
          <li key={card.n} data-reveal style={at(i)}>
            <Card className={styles.card}>
              <p className="label">{card.n}</p>
              <h3 className="h3">{card.title}</h3>
              <p className={styles.cardText}>{card.text}</p>
              <p className={`mono ${styles.cardDetail}`}>{card.detail}</p>
            </Card>
          </li>
        ))}
      </ol>
      <div data-reveal>
        <Card className={styles.flagged}>
          <div>
            <h3 className="h3">{c.flagged.title}</h3>
            <p className={styles.cardText}>{c.flagged.text}</p>
          </div>
          <ul className={styles.chips} aria-label="Reasons shown for flagged events">
            {c.flagged.chips.map((chip, i) => (
              <li key={chip} data-reveal="fade" style={at(i)}>
                <Chip flagged>{chip}</Chip>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Section>
  );
}

/* 7.3 Privacy */
export function Privacy({ copy }: { copy: Copy }) {
  const p = copy.privacy;
  return (
    <Section id="privacy">
      <SectionHead id="privacy" eyebrow={p.eyebrow} title={p.title} lead={p.lead} />
      <dl className={styles.rows2}>
        {p.rows.map((row, i) => (
          <DetailRow key={row.title} {...row} i={i} />
        ))}
      </dl>
      <p className={`small ${styles.closing}`}>{p.closing}</p>
    </Section>
  );
}

/* 7.4 API analytics */
export function Api({ copy }: { copy: Copy }) {
  const a = copy.api;
  const lines = demoLines();
  return (
    <Section id="api">
      <SectionHead id="api" eyebrow={a.eyebrow} title={a.title} lead={a.lead} />
      <div className={styles.split}>
        <FigureFrame label={a.figure.label} caption={a.figure.caption}>
          <NormalizeIsland lines={lines} labels={a.figure} aria={a.figure.aria}>
            <Canvas label={a.figure.aria}>
              <NormalizeStill lines={lines} labels={a.figure} />
            </Canvas>
          </NormalizeIsland>
        </FigureFrame>
        <dl className={styles.rows1}>
          {a.rows.map((row, i) => (
            <DetailRow key={row.title} {...row} i={i} />
          ))}
        </dl>
      </div>
    </Section>
  );
}

/* 7.5 Tracker supply chain */
export function Tracker({ copy }: { copy: Copy }) {
  const t = copy.tracker;
  const data: VerifyData = {
    url: facts.tracker.url,
    integrity: facts.tracker.integrity,
    digest: facts.tracker.digest,
    command: facts.verifyCommand,
    labels: {
      snippet: t.figure.snippetHeading,
      terminal: microcopy.terminal,
      match: t.figure.match,
      release: t.figure.release,
    },
  };
  return (
    <Section id="tracker">
      <SectionHead id="tracker" eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <FigureFrame label={t.figure.label} caption={t.figure.caption}>
        <VerifyIsland data={data} aria={t.figure.aria}>
          <VerifyStill data={data} aria={t.figure.aria} />
        </VerifyIsland>
      </FigureFrame>

      <ul className={styles.facts}>
        {t.facts.map((fact, i) => (
          <li key={fact.detail} data-reveal style={at(i)}>
            <p>{fact.text}</p>
            <p className={`mono ${styles.cardDetail}`}>{fact.detail}</p>
          </li>
        ))}
      </ul>

      <div className={styles.codes}>
        <CodeBlock label={t.snippetFile} code={facts.snippet} event="copy-snippet" copyLabel="Tracker snippet" />
        <CodeBlock
          label={microcopy.terminal}
          code={facts.verifyCommand}
          event="copy-verify-command"
          copyLabel="Verify command"
        />
      </div>
    </Section>
  );
}

/* 7.6 Enrollment */
export function Enrollment({ copy }: { copy: Copy }) {
  const e = copy.enrollment;
  return (
    <Section id="enroll">
      <SectionHead id="enroll" eyebrow={e.eyebrow} title={e.title} lead={e.lead} />
      <ol className={styles.steps}>
        {e.steps.map((step, i) => (
          <li key={step.title} className={styles.step} data-reveal style={at(i)}>
            <p className={`label ${styles.stepNumber}`} aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </p>
            <h3 className="h3">{step.title}</h3>
            <p className={styles.cardText}>{step.text}</p>
          </li>
        ))}
      </ol>
      <div className={styles.enrollEnd}>
        <EnrollButton copy={copy} event="cta-enroll-steps" />
        <p className="small">{e.note}</p>
      </div>
    </Section>
  );
}

/* 7.7 For program operators */
export function Operators({ copy }: { copy: Copy }) {
  const o = copy.operators;
  return (
    <Section id="operators">
      <SectionHead id="operators" eyebrow={o.eyebrow} title={o.title} lead={o.lead} />
      <div className={styles.views}>
        {[o.projects, o.operators].map(group => (
          <div key={group.title} data-reveal>
            <h3 className="h3">{group.title}</h3>
            <ul className={styles.viewList}>
              {group.views.map(view => (
                <li key={view}>
                  <Chip>{view}</Chip>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {site.screenshots ? (
        <figure className={styles.screens}>
          {/* eslint-disable @next/next/no-img-element -- static AVIF files, sized and lazy; next/image would add a runtime optimizer */}
          <img
            src="/screens/operator.avif"
            alt={o.screenshots.operatorAlt}
            width={1200}
            height={750}
            loading="lazy"
            decoding="async"
          />
          <img
            src="/screens/project.avif"
            alt={o.screenshots.projectAlt}
            width={1200}
            height={750}
            loading="lazy"
            decoding="async"
          />
          {/* eslint-enable @next/next/no-img-element */}
          <figcaption className="small">{o.screenshots.caption}</figcaption>
        </figure>
      ) : (
        <OperatorSchematic copy={o} />
      )}
      <p className={`small ${styles.closing}`}>{o.footnote}</p>
    </Section>
  );
}

/* 7.8 Infrastructure and open source */
export function Infrastructure({ copy }: { copy: Copy }) {
  const n = copy.infra;
  return (
    <Section id="open-source">
      <SectionHead id="open-source" eyebrow={n.eyebrow} title={n.title} />
      <dl className={styles.rows1}>
        {n.rows.map((row, i) => (
          <DetailRow key={row.detail} text={row.text} detail={row.detail} i={i} />
        ))}
      </dl>
      {site.repoPublic ? (
        <div className={styles.enrollEnd}>
          <RepoButton label={n.cta} />
        </div>
      ) : null}
    </Section>
  );
}

/* 7.9 FAQ */
export function Faq({ copy }: { copy: Copy }) {
  const f = copy.faq;
  return (
    <Section id="faq">
      <div className={styles.faq}>
        <SectionHead id="faq" eyebrow={f.eyebrow} title={f.title} />
        <div className={styles.faqList}>
          {f.items.map((item, i) => (
            // Native details: no script, keyboard-ready, and the answers stay in the HTML.
            <details key={item.question} className={styles.faqItem}>
              <summary data-umami-event="faq-open" data-umami-event-question={i + 1}>
                <h3 className={styles.faqQuestion}>{item.question}</h3>
                <span className={styles.faqMark} aria-hidden="true" />
              </summary>
              <p className={styles.faqAnswer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* 7.10 Final call to action */
export function FinalCta({ copy }: { copy: Copy }) {
  const f = copy.final;
  return (
    <section aria-labelledby="final-title" className={styles.final}>
      <div className={`container ${styles.finalInner}`}>
        <h2 id="final-title" className="h2">
          {f.title}
        </h2>
        <p className="lead">{f.text}</p>
        <div className={styles.ctas}>
          <EnrollButton copy={copy} event="cta-enroll-final" />
          {site.repoPublic ? (
            <RepoButton label={f.secondary} />
          ) : (
            <Button href="#checks" variant="secondary">
              {f.secondary}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
