module Activity exposing (Msg(..), Options, Row, completed, day, feedbackPoints, hours, rows, update, view)

import Date exposing (Date)
import Dict
import Html exposing (Html)
import Html.Attributes exposing (attribute, class, disabled, style)
import Html.Events exposing (onClick)
import Svg
import Svg.Attributes as SA
import TaskItem exposing (Completion(..), TaskItem)
import Time


type alias Options =
    { visible : Bool, hours : Bool, yearOffset : Int, selected : Maybe String }


type Msg
    = ToggleView
    | ToggleMetric
    | YearChanged Int
    | DaySelected String


type alias Row =
    { person : String, tasks : Int, hours : Float }


update msg options =
    case msg of
        ToggleView ->
            { options | visible = not options.visible }

        ToggleMetric ->
            { options | hours = not options.hours }

        YearChanged delta ->
            { options | yearOffset = options.yearOffset + delta, selected = Nothing }

        DaySelected date ->
            { options | selected = Just date }


completed : List TaskItem -> List TaskItem
completed =
    List.filter TaskItem.isCompleted


hours : TaskItem -> Float
hours task =
    TaskItem.estimateHours task |> Maybe.withDefault 1


matches person task =
    case person of
        Nothing ->
            True

        Just name ->
            List.member (String.toLower name) (List.map String.toLower (TaskItem.assignees task))


rows : Maybe String -> List TaskItem -> List Row
rows person tasks =
    let
        add key name share totals =
            Dict.update key
                (\existing ->
                    case existing of
                        Nothing ->
                            Just { person = name, tasks = 1, hours = share }

                        Just row ->
                            Just { row | tasks = row.tasks + 1, hours = row.hours + share }
                )
                totals

        count task totals =
            let
                names =
                    TaskItem.assignees task

                share =
                    hours task / toFloat (max 1 (List.length names))
            in
            if List.isEmpty names then
                if person == Nothing then
                    add "unassigned:" "Unassigned tasks" share totals

                else
                    totals

            else
                names |> List.filter (\name -> person == Nothing || Maybe.map String.toLower person == Just (String.toLower name)) |> List.foldl (\name -> add ("person:" ++ String.toLower name) name share) totals
    in
    completed tasks |> List.foldl count Dict.empty |> Dict.values |> List.sortBy (.person >> String.toLower)


day : Time.Zone -> TaskItem -> Maybe Date
day zone task =
    case TaskItem.completion task of
        CompletedAt at ->
            Just
                (Date.fromPosix
                    (if String.contains "T" (TaskItem.originalLine task) && String.contains "@completed(" (TaskItem.originalLine task) then
                        zone

                     else
                        Time.utc
                    )
                    at
                )

        _ ->
            Nothing


format value =
    String.fromFloat (toFloat (round (value * 100)) / 100)


view : Time.Zone -> Date -> Options -> Maybe String -> List TaskItem -> Html Msg
view zone today options person tasks =
    let
        done =
            completed tasks |> List.filter (matches person)

        year =
            Date.year today + options.yearOffset

        start =
            Date.fromCalendarDate year Time.Jan 1

        end =
            Date.fromCalendarDate year Time.Dec 31

        first =
            Date.add Date.Days (1 - Date.weekdayToNumber (Date.weekday start)) start

        days =
            List.range 0 (7 * ceiling (toFloat (Date.diff Date.Days first end + 1) / 7) - 1) |> List.map (\index -> Date.add Date.Days index first)

        value task =
            if options.hours then
                hours task
                    / (if person == Nothing then
                        1

                       else
                        toFloat (max 1 (List.length (TaskItem.assignees task)))
                      )

            else
                1

        daily =
            List.foldl
                (\task totals ->
                    case day zone task of
                        Just date ->
                            Dict.update (Date.toRataDie date) (\total -> Just (Maybe.withDefault 0 total + value task)) totals

                        Nothing ->
                            totals
                )
                Dict.empty
                done

        amount date =
            Dict.get (Date.toRataDie date) daily |> Maybe.withDefault 0

        maximum =
            days |> List.map amount |> List.maximum |> Maybe.withDefault 0

        suffix =
            if options.hours then
                " hours"

            else
                " tasks"

        table =
            rows person tasks

        maxBar =
            table
                |> List.map
                    (\row ->
                        if options.hours then
                            row.hours

                        else
                            toFloat row.tasks
                    )
                |> List.maximum
                |> Maybe.withDefault 1
                |> max 1

        cell date =
            let
                count =
                    amount date

                level =
                    if count == 0 then
                        0

                    else
                        min 4 (max 1 (ceiling (4 * count / max 1 maximum)))

                label =
                    Date.toIsoString date ++ ": " ++ format count ++ suffix

                outside =
                    Date.year date /= year
            in
            Html.button
                [ class ("card-board-activity-cell level-" ++ String.fromInt level)
                , disabled outside
                , style "visibility"
                    (if outside then
                        "hidden"

                     else
                        "visible"
                    )
                , attribute "title" label
                , attribute "aria-label" label
                , onClick (DaySelected (Date.toIsoString date))
                ]
                []

        undated =
            done |> List.filter (day zone >> (==) Nothing) |> List.length
    in
    Html.div [ class "card-board-activity" ]
        [ Html.h2 [] [ Html.text "Completed work across the vault" ]
        , Html.p [] [ Html.text "Hours use task durations, divided equally between assignees. Missing durations count as 1 hour per task. Each assignee receives one completed-task count." ]
        , Html.button [ onClick ToggleMetric ]
            [ Html.text
                (if options.hours then
                    "Show task counts"

                 else
                    "Show task hours"
                )
            ]
        , Html.h3 []
            [ Html.text
                ("All-time "
                    ++ (if options.hours then
                            "hours"

                        else
                            "completed tasks"
                       )
                    ++ " per person"
                )
            ]
        , Html.div [ class "card-board-activity-bars" ]
            (table
                |> List.map
                    (\row ->
                        let
                            count =
                                if options.hours then
                                    row.hours

                                else
                                    toFloat row.tasks
                        in
                        Html.div [ class "card-board-activity-bar-row" ] [ Html.span [] [ Html.text row.person ], Html.div [ class "card-board-activity-bar", style "width" (String.fromFloat (100 * count / maxBar) ++ "%") ] [], Html.span [] [ Html.text (format count) ] ]
                    )
            )
        , if List.isEmpty table then
            Html.p [] [ Html.text "No completed tasks for this selection." ]

          else
            Html.text ""
        , if options.hours && Maybe.map String.toLower person == Just "killian" then
            feedbackView zone done

          else
            Html.text ""
        , Html.div [ class "card-board-activity-navigation" ] [ Html.button [ onClick (YearChanged -1) ] [ Html.text "Previous year" ], Html.strong [] [ Html.text (String.fromInt year) ], Html.button [ onClick (YearChanged 1), disabled (year >= Date.year today) ] [ Html.text "Next year" ] ]
        , Html.div [ class "card-board-activity-scroll" ] [ Html.div [ class "card-board-activity-months" ] (List.map (\month -> Html.span [] [ Html.text month ]) [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ]), Html.div [ class "card-board-activity-calendar" ] [ Html.div [ class "card-board-activity-weekdays", attribute "aria-hidden" "true" ] (List.map (\label -> Html.span [] [ Html.text label ]) [ "Mon", "", "Wed", "", "Fri", "", "Sun" ]), Html.div [ class "card-board-activity-grid", attribute "aria-label" "Daily completed activity, Monday through Sunday" ] (List.map cell days) ] ]
        , Html.div [ class "card-board-activity-legend" ]
            ([ Html.text "Less " ] ++ List.map (\level -> Html.span [ class ("card-board-activity-cell level-" ++ String.fromInt level), attribute "aria-hidden" "true" ] []) (List.range 0 4) ++ [ Html.text " More" ])
        , Html.p [] [ Html.text (String.fromInt undated ++ " completed tasks without a completion date are included in totals but excluded from the heatmap.") ]
        , Html.p [ attribute "aria-live" "polite" ] [ Html.text (options.selected |> Maybe.map (\selected -> selected ++ ": " ++ (days |> List.filter (Date.toIsoString >> (==) selected) |> List.head |> Maybe.map (amount >> format) |> Maybe.withDefault "0") ++ suffix) |> Maybe.withDefault "Select a day to see its activity.") ]
        ]


type alias FeedbackPoint =
    { date : Date, estimated : Float, actual : Float }


feedbackPoints : Time.Zone -> List TaskItem -> List FeedbackPoint
feedbackPoints zone tasks =
    let
        dated task =
            Maybe.map2 (\date actual -> ( Date.toRataDie date, ( hours task / toFloat (max 1 (List.length (TaskItem.assignees task))), actual ) )) (day zone task) (TaskItem.actualHours task)

        grouped =
            tasks
                |> List.filter TaskItem.isCompleted
                |> List.filterMap dated
                |> List.foldl
                    (\( date, ( estimated, actual ) ) ->
                        Dict.update date
                            (\old ->
                                let
                                    ( e, a ) =
                                        Maybe.withDefault ( 0, 0 ) old
                                in
                                Just ( e + estimated, a + actual )
                            )
                    )
                    Dict.empty
    in
    grouped
        |> Dict.toList
        |> List.foldl
            (\( date, ( estimated, actual ) ) ( e, a, points ) ->
                ( e + estimated, a + actual, points ++ [ { date = Date.fromRataDie date, estimated = e + estimated, actual = a + actual } ] )
            )
            ( 0, 0, [] )
        |> (\( _, _, points ) -> points)


feedbackView : Time.Zone -> List TaskItem -> Html msg
feedbackView zone tasks =
    let
        points =
            feedbackPoints zone tasks

        last =
            List.reverse points |> List.head

        firstDay =
            List.head points |> Maybe.map (.date >> Date.toRataDie >> (\value -> value - 1)) |> Maybe.withDefault 0

        lastDay =
            last |> Maybe.map (.date >> Date.toRataDie) |> Maybe.withDefault firstDay

        maximum =
            points |> List.concatMap (\point -> [ point.estimated, point.actual ]) |> List.maximum |> Maybe.withDefault 1 |> max 1

        x point =
            55 + 680 * toFloat (Date.toRataDie point.date - firstDay) / toFloat (max 1 (lastDay - firstDay))

        y value =
            230 - 190 * value / maximum

        path getter =
            "55,230 " ++ (points |> List.map (\point -> String.fromFloat (x point) ++ "," ++ String.fromFloat (y (getter point))) |> String.join " ")

        total getter =
            last |> Maybe.map (getter >> format) |> Maybe.withDefault "0"

        missing =
            tasks |> List.filter (TaskItem.actualHours >> (==) Nothing) |> List.length

        undated =
            tasks |> List.filter (\task -> TaskItem.actualHours task /= Nothing && day zone task == Nothing) |> List.length

        label =
            "Killian cumulative hours: estimated " ++ total .estimated ++ ", actual " ++ total .actual
    in
    Html.section [ class "card-board-estimate-feedback" ]
        [ Html.h3 [] [ Html.text "Killian: estimated versus actual cumulative hours" ]
        , Html.p [] [ Html.text ("Comparison includes completed tasks with both recorded actual time and a completion date. " ++ String.fromInt missing ++ " tasks have no actual time; " ++ String.fromInt undated ++ " recorded tasks have no completion date. Missing estimates use the 1-hour task default, divided between assignees.") ]
        , Html.p [] [ Html.span [ class "card-board-estimate-legend" ] [ Html.text ("Estimated: " ++ total .estimated ++ "h") ], Html.text " · ", Html.span [ class "card-board-actual-legend" ] [ Html.text ("Actual: " ++ total .actual ++ "h") ] ]
        , if List.isEmpty points then
            Html.p [] [ Html.text "Complete a dated task and record actual time to start the comparison." ]

          else
            Svg.svg [ SA.viewBox "0 0 800 275", SA.class "card-board-feedback-chart", attribute "role" "img", attribute "aria-label" label ]
                ([ Svg.line [ SA.x1 "55", SA.x2 "735", SA.y1 "230", SA.y2 "230", SA.stroke "currentColor" ] []
                 , Svg.text_ [ SA.x "5", SA.y "40", SA.fill "currentColor" ] [ Svg.text (format maximum ++ "h") ]
                 , Svg.text_ [ SA.x "10", SA.y "230", SA.fill "currentColor" ] [ Svg.text "0h" ]
                 , Svg.text_ [ SA.x "55", SA.y "263", SA.fill "currentColor" ] [ Svg.text (Date.fromRataDie firstDay |> Date.toIsoString) ]
                 , Svg.text_ [ SA.x "735", SA.y "263", SA.textAnchor "end", SA.fill "currentColor" ] [ Svg.text (last |> Maybe.map (.date >> Date.toIsoString) |> Maybe.withDefault "") ]
                 , Svg.polyline [ SA.points (path .estimated), SA.fill "none", SA.stroke "#3478db", SA.strokeWidth "3", SA.strokeDasharray "8 5" ] []
                 , Svg.polyline [ SA.points (path .actual), SA.fill "none", SA.stroke "#d66a12", SA.strokeWidth "3" ] []
                 ]
                    ++ List.concatMap (\point -> [ Svg.circle [ SA.cx (String.fromFloat (x point)), SA.cy (String.fromFloat (y point.actual)), SA.r "4", SA.fill "#d66a12" ] [ Svg.title [] [ Svg.text (Date.toIsoString point.date ++ ": estimated " ++ format point.estimated ++ "h, actual " ++ format point.actual ++ "h") ] ] ]) points
                )
        , Html.details [] [ Html.summary [] [ Html.text "Daily cumulative values" ], Html.table [] [ Html.thead [] [ Html.tr [] (List.map (\heading -> Html.th [] [ Html.text heading ]) [ "Completion date", "Estimated hours", "Actual hours" ]) ], Html.tbody [] (List.map (\point -> Html.tr [] [ Html.td [] [ Html.text (Date.toIsoString point.date) ], Html.td [] [ Html.text (format point.estimated) ], Html.td [] [ Html.text (format point.actual) ] ]) points) ] ]
        ]
