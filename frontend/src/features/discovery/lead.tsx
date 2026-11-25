import Link from "next/link";

interface Feature {
  href: string;
  title: string;
  byline: string;
}

export function DiscoveryLead({
  journal = false,
  feature,
  action,
}: {
  journal?: boolean;
  feature?: Feature;
  action: { href: string; label: string };
}) {
  const cover = (
    <img
      src={journal ? "/art/parisStreets.jpg" : "/art/parisTower.jpg"}
      alt={
        journal
          ? "Pont Alexandre III in Paris at dusk"
          : "The Eiffel Tower from the Seine"
      }
      width={2160}
      height={journal ? 1528 : 1436}
    />
  );
  return (
    <section
      className={
        "discovery-lead " + (journal ? "journal-lead" : "planner-lead")
      }
    >
      {feature ? (
        <Link
          href={feature.href}
          className="discovery-feature"
          aria-label={feature.title}
        >
          {cover}
          <span className="discovery-kicker">
            {journal ? "The slow travel edit" : "A route worth borrowing"}
          </span>
          <h2>{feature.title}</h2>
          <p>{feature.byline}</p>
        </Link>
      ) : (
        <div className="discovery-feature">{cover}</div>
      )}
      <aside className="discovery-invitation">
        <span className="discovery-kicker">
          {journal ? "Your notebook" : "Public itineraries"}
        </span>
        <h2>
          {journal ? "Tell the part you remember." : "Explore another route."}
        </h2>
        <p>
          {journal ? (
            <>
              The street you turned down.
              <br />
              The lunch that ran long.
              <br />
              The afternoon you left open.
            </>
          ) : (
            "Browse public plans by city, country and trip length."
          )}
        </p>
        <Link href={action.href}>
          {action.label} <span aria-hidden="true">→</span>
        </Link>
      </aside>
    </section>
  );
}
