import Act from "./components/Act";
import CastList from "./components/CastList";
import Cover from "./components/Cover";
import PromptBook from "./components/PromptBook";
import { boxOffice, cast, houseTerms, job, lanes, notes, promptBook, actors } from "./copy";

export default function App() {
  return (
    <>
      <Cover />
      <main className="paper">
        <div className="paper-grain" />

        <Act id="job" rail={job.rail}>
          <h2>{job.heading}</h2>
          {job.paragraphs.map((paragraph) => (
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
        </Act>

        <Act id="cast" rail={cast.rail} wide>
          <h2>{cast.heading}</h2>
          <CastList rows={actors} />
          <div className="cast space">
            <CastList rows={houseTerms} delay={0.08} />
          </div>
        </Act>

        <Act id="prompt-book" rail={promptBook.rail} wide>
          <h2>{promptBook.heading}</h2>
          <PromptBook />
          <p>{promptBook.after}</p>
        </Act>

        <Act id="box-office" rail={boxOffice.rail} wide>
          <h2>{boxOffice.heading}</h2>
          <p>{boxOffice.intro}</p>
          <CastList rows={boxOffice.rows} />
        </Act>

        <Act id="notes" rail={notes.rail}>
          <div className="notes">
            <h2>{notes.heading}</h2>
            {notes.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <div className="colophon">
              <p>
                Red is for failure. I used it once, on an illustrated{" "}
                <span className="fail">exit 1</span>.
              </p>
              <p className="tag">{notes.tag}</p>
            </div>
          </div>
        </Act>
      </main>
    </>
  );
}
