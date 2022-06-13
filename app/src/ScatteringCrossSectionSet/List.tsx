import { ListItem } from "./ListItem";
import { CrossSectionSetHeading } from "@lxcat/database/dist/css/public";

interface Props {
  items: CrossSectionSetHeading[];
}

export function List({ items }: Props) {
  return (
    <div style={{ display: "flex", gap: "1em", flexWrap: "wrap" }}>
      {items.map((d) => (
        <ListItem key={d.id} {...d} />
      ))}
    </div>
  );
}
