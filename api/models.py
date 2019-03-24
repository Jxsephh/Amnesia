from flask import Flask
from flask_restful import Api, Resource, reqparse
from api.nodes import data 

#This pretty much comes from https://codeburst.io/this-is-how-easy-it-is-to-create-a-rest-api-8a25122ab1f3

app = Flask(__name__)
api = Api(app)

class Story(Resource):
    def get(self, id): 
        for node in data.nodes:
            if(id == node["id"]):
                return node, 200
    
        return "Node not found", 404
    def post(self, id): #Probably useless
        parser = reqparse.RequestParser()
        parser.add_argument("dialogue")
        parser.add_argument("choiceA")
        parser.add_argument("choiceB")
        args = parser.parse_args()

        for node in data.nodes:
            if(id == node["id"]):
                return "Node with id {} already exists".format(id), 400

        node = {
            "id": id,
            "dialogue": args["dialogue"],
            "choiceA": args["choiceA"],
            "choiceB": args["choiceB"]
        }
        data.nodes.append(node)
        return node, 201

    def put(self, id): #Also probably useless
        parser = reqparse.RequestParser()
        parser.add_argument("dialogue")
        parser.add_argument("choiceA")
        parser.add_argument("choiceB")
        args = parser.parse_args()

        for node in data.nodes:
            if(id == node["id"]):
                node["dialogue"] = args["dialogue"]
                node["choiceA"] = args["choiceA"]
                node["choiceB"] = args["choiceB"]
                return node, 200
        
        node = {
            "id": id,
            "dialogue": args["dialogue"],
            "choiceA": args["choiceA"],
            "choiceB": args["choiceB"]
        }
        data.nodes.append(node)
        return node, 201

    def delete(self, name): #Also probably useless
        global ndoes
        nodes = [node for node in data.nodes if node["name"] != name]
        return "{} is deleted.".format(name), 200

api.add_resource(Story, "/node/<string:id>")