import Link from "next/link"
import { Button } from "../ui/button"

export function HeroButtons() {
    return (
        <>
            <Link href="/home"><Button>Explore Labs</Button></Link>
            <Button>Github</Button>
        </>
    )
}