import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ART_SIZE, artistSearchUrl, fetchArt, isPrintingId } from "./art";
import { useI18n } from "./i18n";

/** One printing's art as large as Scryfall serves it, with the artist and a link to the card on Scryfall. */
export function ArtPage() {
  const { t, locale } = useI18n();
  const { printingId } = useParams({ strict: false }) as { printingId: string };
  const valid = isPrintingId(printingId);
  const { data, isLoading, error } = useQuery({
    queryKey: ["art", printingId],
    queryFn: ({ signal }) => fetchArt(printingId, signal),
    enabled: valid,
    staleTime: 24 * 60 * 60 * 1000, // Scryfall asks to cache its data; one request per card and day is plenty
  });
  const [face, setFace] = useState(0);
  const [full, setFull] = useState(false);
  const current = data?.faces[face] ?? data?.faces[0];
  const shown = full ? current?.png : current?.artCrop;
  const size = full ? ART_SIZE.png : ART_SIZE.artCrop;
  const date = data?.releasedAt ? new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(data.releasedAt)) : null;

  return (
    <main className="page art-page">
      <p>
        <Link to="/collection">{t("art.back")}</Link>
      </p>
      <h1>{t("art.title")}</h1>
      {!valid && <p className="error">{t("art.invalid")}</p>}
      {valid && isLoading && <p className="hint">{t("art.loading")}</p>}
      {valid && error && <p className="error">{t("art.error", { message: error.message })}</p>}

      {data && current && (
        <>
          <h2>{data.faces.length > 1 ? current.name : data.name}</h2>
          {data.faces.length > 1 && (
            <div className="chips" role="group" aria-label={t("art.faces")}>
              {data.faces.map((f, i) => (
                <button key={f.name + i} type="button" className={i === face ? "chip on" : "chip"} aria-pressed={i === face} onClick={() => setFace(i)}>
                  {f.name}
                </button>
              ))}
            </div>
          )}
          <div className="chips" role="group" aria-label={t("art.show")}>
            <button type="button" className={!full ? "chip on" : "chip"} aria-pressed={!full} onClick={() => setFull(false)}>
              {t("art.artOnly")}
            </button>
            <button type="button" className={full ? "chip on" : "chip"} aria-pressed={full} onClick={() => setFull(true)}>
              {t("art.fullCard")}
            </button>
          </div>

          {shown ? (
            <figure className="art-figure">
              <img src={shown} alt={current.name} width={size.width} height={size.height} />
              <figcaption className="hint">{t(full ? "art.size.full" : "art.size.art", { w: size.width, h: size.height })}</figcaption>
            </figure>
          ) : (
            <p className="hint">{t("art.noImage")}</p>
          )}
          {shown && (
            <p>
              <a href={shown} target="_blank" rel="noopener noreferrer">
                {t("art.open")} ↗
              </a>
            </p>
          )}

          <dl className="art-info">
            <dt>{t("art.artist")}</dt>
            <dd>
              {current.artist ? (
                <>
                  <strong>{current.artist}</strong>{" "}
                  <a href={artistSearchUrl(current.artist)} target="_blank" rel="noopener noreferrer">
                    {t("art.moreBy", { artist: current.artist })} ↗
                  </a>
                </>
              ) : (
                t("art.unknownArtist")
              )}
            </dd>
            <dt>{t("art.card")}</dt>
            <dd>
              {data.setName} ({data.setCode.toUpperCase()}) #{data.collectorNumber}
            </dd>
            {date && (
              <>
                <dt>{t("art.released")}</dt>
                <dd>{date}</dd>
              </>
            )}
            {current.flavorText && (
              <>
                <dt>{t("art.flavor")}</dt>
                <dd>
                  <em>{current.flavorText}</em>
                </dd>
              </>
            )}
          </dl>
          {data.scryfallUri && (
            <p>
              <a href={data.scryfallUri} target="_blank" rel="noopener noreferrer">
                {t("art.scryfall")} ↗
              </a>
            </p>
          )}
          <p className="hint">{t("art.credit")}</p>
        </>
      )}
    </main>
  );
}
