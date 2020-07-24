module.exports = function SurveyHistory(sequelize) {
    var Sequelize = sequelize.constructor;
  var surveyAnswerHistory = require('./surveyAnswerHistory.model') (sequelize);
  var lsgi = require('./lsgi.model')(sequelize);
  var lsgi_type = require('./lsgiType.model')(sequelize);
  var lsgi_block = require('./lsgiBlock.model')(sequelize);
  var office_type = require('./officeType.model')(sequelize);
  var user = require('./user.model')(sequelize);
  var district = require('./district.model')(sequelize);

    var ret =
      sequelize.define('surveyHistory', {
        office_name: {
          type: Sequelize.STRING
        },
        survey_id:{
          type: Sequelize.INTEGER
        },
        email: {
          type: Sequelize.STRING
        },
        phone: {
          type: Sequelize.STRING
        },
        address: {
          type: Sequelize.STRING
        },
        lead_person_name: {
          type: Sequelize.STRING
        },
        lead_person_designation: {
          type: Sequelize.STRING
        },
        lat: {
          type: Sequelize.DOUBLE
        },
        lng: {
          type: Sequelize.DOUBLE
        },
        points: {
          type: Sequelize.FLOAT
        },
    
        lsgi_block_id: {
          type: Sequelize.INTEGER
        },
        district_id: {
          type: Sequelize.INTEGER
        },
        lsgi_id: {
          type: Sequelize.INTEGER
        },
        survey_closing_date:{
          type: 'TIMESTAMP',
          allowNull: false
        },
        lsgi_type_id: {
          type: Sequelize.INTEGER
        },
        office_type_id: {
          type: Sequelize.INTEGER
        },
        informer_name: {
          type: Sequelize.STRING
        },
        informer_designation: {
          type: Sequelize.STRING
        },
        informer_phone: {
          type: Sequelize.STRING
        },
        status: {
          type: Sequelize.INTEGER
        },
        survey_date: {
          type: 'TIMESTAMP',
          allowNull: false
        },
        surveyor_account_id: {
          type: Sequelize.INTEGER
        },
        grade: {
          type: Sequelize.STRING
        },
        is_active: {
          type: Sequelize.INTEGER
        },
        is_last_survey: {
          type: Sequelize.INTEGER
        },
        area_km2: {
          type: Sequelize.DOUBLE
        },
        house_count: {
          type: Sequelize.INTEGER
        },
        ward_count: {
          type: Sequelize.INTEGER
        },
        population_count: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
        modified_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
  
      }, {
        tableName: 'survey_history',
        timestamps: false
  
      });
      ret.hasMany(surveyAnswerHistory, {foreignKey: 'survey_history_id' ,sourceKey: 'id'});
     // ret.hasMany(surveyAnswerHistory, {foreignKey: 'survey_id' ,sourceKey: 'survey_id'});
      ret.belongsTo(lsgi, { foreignKey: 'lsgi_id' });
      ret.belongsTo(lsgi_type, { foreignKey: 'lsgi_type_id' });
      ret.belongsTo(lsgi_block, { foreignKey: 'lsgi_block_id' });
      ret.belongsTo(office_type, { foreignKey: 'office_type_id' });
      ret.belongsTo(user, { foreignKey: 'surveyor_account_id' });
      ret.belongsTo(district, { foreignKey: 'district_id' });
        
    return ret;
  }
  