import { Fragment } from "react";
import Act from "./components/Act";
import CastList from "./components/CastList";
import Cover from "./components/Cover";
import PromptBook from "./components/PromptBook";
import {
  actors,
  boxOffice,
  cast,
  house,
  houseTerms,
  lanes,
  loop,
  notes,
  notPlaying,
  oneLiner,
  problem,
  promptBook,
  tonight,
} from "./copy";

export default function App() {
  return (
    <>
      <Cover />
      <main className="paper">
        <div className="paper-grain" />

        <Act id="tonight" rail={tonight.rail}>
          <h2>{tonight.heading}</h2>
          <p className="lede">{oneLiner}</p>
          {tonight.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </Act>

        <Act id="problem" rail={problem.rail}>
          <h2>{problem.heading}</h2>
          {problem.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </Act>

        <Act id="lanes" rail={lanes.rail} wide>
          <h2>{lanes.heading}</h2>
          <div className="lane-pair">
            <div className="lane">
              <span className="lane-kicker">{lanes.verified.kicker}</span>
              <h3>{lanes.verified.title}</h3>
              <p>{lanes.verified.body}</p>
            </div>
            <div className="lane">
              <span className="lane-kicker">{lanes.judgement.kicker}</span>
              <h3>{lanes.judgement.title}</h3>
              <p>{lanes.judgement.body}</p>
            </div>
          </div>
          <dl className="facts">
            {lanes.facts.map((fact) => (
              <Fragment key={fact.dt}>
                <dt>{fact.dt}</dt>
                <dd>
                  {fact.dt === "reported as" ? (
                    <>
                      <i>verified</i>, <i>failed verification</i>, <i>not verified</i>.
                      Those three words are reserved for the verified lane. Judgement never
                      borrows them.
                    </>
                  ) : (
                    fact.dd
                  )}
                </dd>
              </Fragment>
            ))}
          </dl>
          <p className="space">{lanes.closer}</p>
        </Act>

        <Act id="cast" rail={cast.rail} wide>
          <h2>{cast.heading}</h2>
          <p>{cast.intro}</p>
          <p className="cast-head">{cast.actorsHead}</p>
          <CastList rows={actors} />
          <p className="cast-head" style={{ marginTop: "2.25rem" }}>
            {cast.houseHead}
          </p>
          <CastList rows={houseTerms} delay={0.12} />
          <p className="space">
            Deliberately not <i>Production</i> for a Show. In any developer tool{" "}
            <i>production</i> means the live environment, and that ambiguity produces
            incidents.
          </p>
        </Act>

        <Act id="prompt-book" rail={promptBook.rail} wide>
          <h2>{promptBook.heading}</h2>
          <p>{promptBook.intro}</p>
          <PromptBook />
          {promptBook.after.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </Act>

        <Act id="loop" rail={loop.rail}>
          <h2>{loop.heading}</h2>
          <p>{loop.intro}</p>
          <ol className="steps">
            {loop.steps.map((step) => (
              <li key={step.n}>
                <span className="num">{step.n}</span>
                <div>
                  <strong>{step.title}</strong>
                  <span>{step.body}</span>
                </div>
              </li>
            ))}
          </ol>
        </Act>

        <Act id="house" rail={house.rail}>
          <h2>{house.heading}</h2>
          {house.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </Act>

        <Act id="box-office" rail={boxOffice.rail} wide>
          <h2>{boxOffice.heading}</h2>
          {boxOffice.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <CastList rows={boxOffice.rows} />
        </Act>

        <Act id="not-playing" rail={notPlaying.rail}>
          <h2>{notPlaying.heading}</h2>
          <ul className="not-list">
            {notPlaying.items.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong> {item.body}
              </li>
            ))}
          </ul>
        </Act>

        <Act id="notes" rail={notes.rail}>
          <div className="notes">
            <h2>{notes.heading}</h2>
            {notes.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <div className="colophon">
              <p>
                No customers. No testimonials. No dashboard. Red is reserved for failure. I
                used it once, on an illustrated <span className="fail">exit 1</span>.
              </p>
              <p className="tag">{notes.tag}</p>
            </div>
          </div>
        </Act>
      </main>
    </>
  );
}
