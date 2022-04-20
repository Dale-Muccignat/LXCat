import { Reference } from "./Reference"
import { Reference as ReferenceRecord } from "./types/reference"

interface Props {
    references: ReferenceRecord[]
}

export const HowToCite = ({references}: Props) => {
    return (
        <div>
            <h2>How to reference data</h2>
            <ul>
                <li>Reference to LXCat</li>
                {references.map((r) => <li key={r.title}><Reference {...r}/></li>)}
            </ul>
            ...
        </div>
    )
}