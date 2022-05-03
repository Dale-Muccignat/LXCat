import Link from "next/link";
import { ReactionSummary } from "./ReactionSummary";
import { CrossSectionHeading } from "./types/public";

export function ListItem(props: CrossSectionHeading) {
    return (
        <Link href={`/scat-cs/${props.id}`} passHref>
            <a style={{boxShadow: '3px 5px 2px gray', padding: 4, border: '1px black solid'}}>
                <ReactionSummary {...props.reaction}/>
                <div>Part of &quot;{props.isPartOf.name}&quot; set</div>
            </a>
        </Link>
    )
}
