module PlainDueDate exposing (fromString, parser)

import Date exposing (Date)
import DueDate exposing (DueDate(..))
import Parser as P exposing ((|.), (|=), Parser)
import ParserHelper


{-| A missing year is resolved against the local year supplied by the caller.
Without that context only the explicit two-digit-year form is recognised.
-}
parser : Maybe Int -> Parser DueDate
parser currentYear =
    P.succeed identity
        |. P.token "due"
        |. P.chompIf ParserHelper.isSpaceOrTab
        |. P.chompWhile ParserHelper.isSpaceOrTab
        |= P.getChompedString (P.chompWhile (\c -> not (ParserHelper.isSpaceOrTab c) && c /= '\n' && c /= '\u{000D}'))
        |> P.andThen
            (\text ->
                case parseDate currentYear text of
                    Just date ->
                        P.succeed (SetToDate date)

                    Nothing ->
                        P.problem "Invalid due date"
            )


fromString : Int -> String -> Maybe Date
fromString currentYear input =
    let
        text =
            String.trim input
    in
    case Date.fromIsoString text of
        Ok date ->
            Just date

        Err _ ->
            if String.startsWith "due " text then
                parseDate (Just currentYear) (String.trim (String.dropLeft 4 text))

            else
                parseDate (Just currentYear) text


parseDate : Maybe Int -> String -> Maybe Date
parseDate currentYear text =
    let
        validPart part =
            String.length part == 2 && String.all Char.isDigit part

        build year day month =
            Date.fromIsoString (String.fromInt year ++ "-" ++ month ++ "-" ++ day)
                |> Result.toMaybe
    in
    case String.split "-" text of
        [ day, month, year ] ->
            if List.all validPart [ day, month, year ] then
                String.toInt year |> Maybe.andThen (\y -> build (2000 + y) day month)

            else
                Nothing

        [ day, month ] ->
            if List.all validPart [ day, month ] then
                currentYear |> Maybe.andThen (\y -> build y day month)

            else
                Nothing

        _ ->
            Nothing
