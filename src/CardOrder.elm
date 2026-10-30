module CardOrder exposing (Order, decoder, encoder, sort, taskKey)

import Card exposing (Card)
import Dict
import Regex
import TaskItem exposing (TaskItem)
import TsJson.Decode as D
import TsJson.Encode as E


type alias Order =
    { board : String, column : String, tasks : List String }


decoder : D.Decoder Order
decoder =
    D.succeed Order
        |> D.andMap (D.field "board" D.string)
        |> D.andMap (D.field "column" D.string)
        |> D.andMap (D.field "tasks" (D.list D.string))


encoder : E.Encoder Order
encoder =
    E.object
        [ E.required "board" .board E.string
        , E.required "column" .column E.string
        , E.required "tasks" .tasks (E.list E.string)
        ]


taskKey : TaskItem -> String
taskKey task =
    let
        blockId =
            Regex.find blockIdPattern (TaskItem.originalLine task)
                |> List.head
                |> Maybe.andThen (.submatches >> List.head)
                |> Maybe.andThen identity
    in
    blockId
        |> Maybe.map (\id -> TaskItem.filePath task ++ "#^" ++ id)
        |> Maybe.withDefault (TaskItem.id task)


sort : List Order -> String -> String -> List Card -> List Card
sort orders board column cards =
    let
        keys =
            orders |> List.filter (\order -> order.board == board && order.column == column) |> List.head |> Maybe.map .tasks |> Maybe.withDefault []

        unrankedBase =
            List.length keys

        ranks =
            Dict.fromList (List.indexedMap (\index key -> ( key, index )) keys)
    in
    if List.isEmpty keys then
        cards

    else
        cards
            |> List.indexedMap (\index card -> ( Maybe.withDefault (unrankedBase + index) (Dict.get (taskKey (Card.taskItem card)) ranks), card ))
            |> List.sortBy Tuple.first
            |> List.map Tuple.second


blockIdPattern : Regex.Regex
blockIdPattern =
    Regex.fromString "(?:^|[ \\t])\\^([A-Za-z0-9-]+)[ \\t]*$" |> Maybe.withDefault Regex.never
