module Person exposing (Person, colorAttributes, colorKey, defaultColor, foreground, parser)

import FNV1a
import Html exposing (Attribute)
import Html.Attributes exposing (attribute)
import Parser as P exposing ((|.), (|=), Parser)


type alias Person =
    { name : String, color : String }


parser : Parser String
parser =
    P.succeed String.trim
        |. P.token "@assigned("
        |= P.getChompedString (P.chompWhile (\c -> c /= ')' && c /= '(' && c /= '\n' && c /= '\u{000D}'))
        |. P.token ")"
        |> P.andThen
            (\name ->
                if String.isEmpty name then
                    P.problem "An assignee needs a name"

                else
                    P.succeed name
            )


colorKey : String -> String
colorKey name =
    "--card-board-person-" ++ String.fromInt (FNV1a.hash (String.toLower (String.trim name)))


defaultColor : String -> String
defaultColor name =
    "hsl(" ++ String.fromInt (modBy 360 (FNV1a.hash (String.toLower (String.trim name)))) ++ ", 65%, 85%)"


colorAttributes : List Person -> List (Attribute msg)
colorAttributes people =
    [ attribute "style"
        (people
            |> List.filter (\person -> String.length person.color == 7 && String.startsWith "#" person.color && String.all isHex (String.dropLeft 1 person.color))
            |> List.map
                (\person ->
                    colorKey person.name
                        ++ ":"
                        ++ person.color
                        ++ ";"
                        ++ colorKey person.name
                        ++ "-foreground:"
                        ++ foreground person.color
                        ++ ";"
                )
            |> String.join ""
        )
    ]


isHex : Char -> Bool
isHex char =
    Char.isDigit char || List.member (Char.toLower char) [ 'a', 'b', 'c', 'd', 'e', 'f' ]


foreground : String -> String
foreground color =
    let
        component text =
            text
                |> String.toList
                |> List.foldl (\char value -> value * 16 + hexValue char) 0
                |> toFloat
                |> (\value -> value / 255)
                |> (\value ->
                        if value <= 0.04045 then
                            value / 12.92

                        else
                            ((value + 0.055) / 1.055) ^ 2.4
                   )

        luminance =
            0.2126
                * component (String.slice 1 3 color)
                + 0.7152
                * component (String.slice 3 5 color)
                + 0.0722
                * component (String.slice 5 7 color)
    in
    if luminance > 0.179 then
        "#111111"

    else
        "#ffffff"


hexValue : Char -> Int
hexValue char =
    if Char.isDigit char then
        Char.toCode char - Char.toCode '0'

    else
        Char.toCode (Char.toLower char) - Char.toCode 'a' + 10
