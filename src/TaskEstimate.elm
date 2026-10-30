module TaskEstimate exposing (parser, spentParser)

import Parser as P exposing ((|.), (|=), Parser)


parser : Parser Float
parser =
    durationParser (P.oneOf [ P.token "@takes(", P.token "@estimate(" ])


spentParser : Parser Float
spentParser =
    durationParser (P.token "@spent(")


durationParser : Parser () -> Parser Float
durationParser tag =
    P.succeed (*)
        |. tag
        |= P.float
        |= P.oneOf [ P.succeed 1 |. P.token "h", P.succeed 8 |. P.token "d" ]
        |. P.token ")"
        |> P.andThen
            (\hours ->
                if hours > 0 && not (isInfinite hours) && not (isNaN hours) then
                    P.succeed hours

                else
                    P.problem "An estimate must be a positive duration"
            )
