module TaskEstimate exposing (parser)

import Parser as P exposing ((|.), (|=), Parser)


parser : Parser Float
parser =
    P.succeed (*)
        |. P.token "@estimate("
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
