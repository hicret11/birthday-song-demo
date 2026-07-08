/**
 * Server-safe JSON-LD injector. Renders a single <script> tag with serialized
 * schema.org structured data. Render this in the page body (not via metadata)
 * so we never duplicate the <script>.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
