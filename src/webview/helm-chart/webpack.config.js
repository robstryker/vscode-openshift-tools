/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const HtmlWebPackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const isProduction = process.argv[process.argv.indexOf('--mode') + 1] === 'production';

module.exports = {
    entry: {
        helmChartViewer: "./src/webview/helm-chart/app/index.tsx"
    },
    output: {
        path: path.resolve(__dirname, "../../../out", "helmChartViewer"),
        filename: "[name].js"
    },
    devtool: "eval-source-map",
    resolve: {
        extensions: [".js", ".ts", ".tsx", ".json"]
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                loader: "ts-loader",
            },
            {
                test: /\.(css|scss)$/,
                use: [
                    {
                        loader: "style-loader",
                    },
                    {
                        loader: "css-loader",
                    },
                    {
                        loader: "sass-loader",
                    }
                ]
            },
            {
                test: /\.(png|jpg|jpeg|gif|svg|woff2?|ttf|eot|otf)(\?.*$|$)/,
                loader: 'file-loader',
                options: {
                    name: 'assets/[name].[ext]',
                },
            },
        ]
    },
    performance: {
        hints: false,
    },
    plugins: [
        new HtmlWebPackPlugin({
            template: path.resolve(__dirname, 'app', 'index.html'),
            filename: 'index.html',
            templateParameters: {
                production: isProduction
            }
        })
    ],
};
