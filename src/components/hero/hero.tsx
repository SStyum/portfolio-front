import Link from "next/link";
import { ArrowRight, Gamepad2, LayoutGrid } from "lucide-react";
import { profile } from "@/src/content";
import { AuthButtons } from "../auth/signup/signup-button";
import { GAME_HREF } from "../site/sectors";
import { ThemeToggle } from "../themeToggle/themeToggle";
import { TypingText } from "./typing-text";

// mini prévia do site: blocos que lembram as seções
function SitePreview() {
    return (
        <div className="grid gap-2 rounded-xl border bg-background/60 p-3" aria-hidden>
            <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#ffc857]" />
                <span className="h-2 w-16 rounded-full bg-foreground/15" />
                <span className="ml-auto h-2 w-8 rounded-full bg-foreground/10" />
            </div>
            <span className="h-3 w-3/4 rounded-full bg-foreground/25" />
            <span className="h-2 w-1/2 rounded-full bg-foreground/10" />
            <div className="mt-1 grid grid-cols-3 gap-2">
                {["#6fd08c", "#4cc9f0", "#ff8fa3"].map((c) => (
                    <span key={c} className="h-10 rounded-md border" style={{ background: `linear-gradient(135deg, ${c}33, transparent)` }} />
                ))}
            </div>
        </div>
    );
}

// mini prévia do jogo: céu, sol, colinas e os feixes de luz dos setores
function GamePreview() {
    return (
        <div className="relative h-[124px] overflow-hidden rounded-xl border bg-gradient-to-b from-[#4f9fe0] to-[#f7dcb4]" aria-hidden>
            <span className="absolute right-6 top-4 size-8 rounded-full bg-[#fff3c4] shadow-[0_0_30px_#fff3c4]" />
            {["#ffc857", "#6fd08c", "#ff8fa3", "#4cc9f0", "#b388ff"].map((c, i) => (
                <span
                    key={c}
                    className="absolute bottom-6 w-1.5 rounded-full opacity-80"
                    style={{ left: `${14 + i * 17}%`, height: `${50 + (i % 3) * 14}px`, background: `linear-gradient(to top, ${c}, transparent)` }}
                />
            ))}
            <span className="absolute -bottom-10 -left-6 h-20 w-2/3 rounded-[50%] bg-[#6b8f5e]" />
            <span className="absolute -bottom-12 right-[-10%] h-24 w-3/4 rounded-[50%] bg-[#7fa36d]" />
        </div>
    );
}

export function Hero() {
    return (
        <section className="relative flex min-h-screen flex-col overflow-hidden">
            <div className="bg-grid pointer-events-none absolute inset-0" />
            <div className="animate-float-slow pointer-events-none absolute -top-32 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-[#f2c879]/12 blur-3xl" />

            <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
                <span className="font-mono text-sm text-muted-foreground">engineering playground</span>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <AuthButtons />
                </div>
            </div>

            <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 pb-16 pt-8 text-center md:px-6">
                <p className="mb-5 h-9">
                    <TypingText
                        words={[
                            "Hello World",          // Inglês
                            "Hola Mundo",           // Espanhol
                            "Olá Mundo",            // Português
                            "Bonjour le Monde",     // Francês
                            "Ciao Mondo",           // Italiano
                            "Hallo Welt",           // Alemão
                            "Hallo Wereld",         // Holandês
                            "Hei Verden",           // Norueguês
                            "Hej Värld",            // Sueco
                            "Hej Verden",           // Dinamarquês
                            "Hei Maailma",          // Finlandês
                            "Halo Dunia",           // Indonésio / Malaio
                            "Salam Dunia",          // Persa (Farsi)
                            "Ahoj Světe",           // Tcheco
                            "Witaj Świecie",        // Polonês
                            "Helló Világ",          // Húngaro
                            "Salut Lume",           // Romeno
                            "Здравей, свят",        // Búlgaro
                            "Привет, мир",          // Russo
                            "Привіт, світе",        // Ucraniano
                            "Салам Дүйнө",          // Quirguiz
                            "Здравствуй, мир",      // Bielorrusso
                            "Γειά σου Κόσμε",       // Grego
                            "Merhaba Dünya",        // Turco
                            "שלום עולם",            // Hebraico
                            "مرحباً يا عالم",       // Árabe
                            "नमस्ते दुनिया",         // Hindi
                            "হ্যালো ওয়ার্ল্ড",       // Bengali
                            "ਹੈਲੋ ਵਰਲਡ",            // Punjabi
                            "ஹலோ வேர்ல்ட்",        // Tâmil
                            "హロー వరల్డ్",        // Telugu
                            "ഹലോ വേൾഡ്",          // Malayalam
                            "สวัสดีชาวโลก",         // Tailandês
                            "Chào thế giới",        // Vietnamita
                            "Mingalaba Kabar",      // Birmanês
                            "こんにちは世界",        // Japonês
                            "안녕하세요 세계",        // Coreano
                            "你好世界",             // Chinês (Simplificado)
                            "你好世界",             // Chinês (Tradicional)
                            "Kumusta Mundo",        // Tagalo (Filipino)
                            "Mambo Dunia",          // Suaíli
                            "Lefatshe Lea Lumela",  // Sotho
                            "Sawubona Mhlaba",      // Zulu
                            "Kaixo Mundua",         // Basco
                            "Dia daoibh, a dhomhain" // Irlandês
                        ]}
                    />
                </p>
                <h1 className="font-display text-5xl font-semibold tracking-tight text-balance sm:text-6xl md:text-7xl">
                    Engineering <span className="text-gradient">Playground</span>
                </h1>
                <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
                    O portfólio de {profile.name}, {profile.role.toLowerCase()}. Onde engenharia de software encontra criatividade.
                </p>

                <h2 className="mt-14 font-mono text-sm uppercase tracking-widest text-muted-foreground">
                    Como você quer explorar?
                </h2>
                <div className="mt-6 grid w-full gap-5 text-left md:grid-cols-2">
                    <Link
                        href="/home"
                        className="group flex flex-col gap-5 rounded-3xl border bg-card/70 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-foreground/25 hover:shadow-[0_24px_70px_-24px_var(--glow)] md:p-7"
                    >
                        <SitePreview />
                        <div>
                            <p className="flex items-center gap-2 font-display text-2xl font-semibold">
                                <LayoutGrid className="size-5 text-primary" /> Modo site
                            </p>
                            <p className="mt-2 text-muted-foreground">
                                Direto ao ponto: projetos, métricas ao vivo, blog e contato. Funciona em qualquer tela.
                            </p>
                        </div>
                        <span className="mt-auto inline-flex items-center gap-1.5 font-medium">
                            Abrir o site <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                        </span>
                    </Link>

                    {/* <a> e não <Link>: o jogo carrega como página própria (WebGL + CSS do jogo) */}
                    <a
                        href={GAME_HREF}
                        className="group flex flex-col gap-5 rounded-3xl border bg-card/70 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-foreground/25 hover:shadow-[0_24px_70px_-24px_var(--glow)] md:p-7"
                    >
                        <GamePreview />
                        <div>
                            <p className="flex items-center gap-2 font-display text-2xl font-semibold">
                                <Gamepad2 className="size-5 text-primary" /> Modo jogo
                            </p>
                            <p className="mt-2 text-muted-foreground">
                                Desça a escadaria e explore uma Tóquio 3D: cada prédio guarda uma parte do portfólio. Tem espada e parkour. Melhor no computador.
                            </p>
                        </div>
                        <span className="mt-auto inline-flex items-center gap-1.5 font-medium">
                            Entrar em Tóquio <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                        </span>
                    </a>
                </div>
            </div>
        </section>
    );
}
